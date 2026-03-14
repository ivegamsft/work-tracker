terraform {
  required_providers {
    azurerm = {
      source = "hashicorp/azurerm"
    }
    random = {
      source = "hashicorp/random"
    }
  }
}

locals {
  name_prefix                    = "${var.project_name}-${var.environment}"
  container_app_environment_name = "${local.name_prefix}-aca"
  api_app_name                   = "${local.name_prefix}-api"
  jwt_secret_name                = "${local.name_prefix}-jwt-secret"

  tags = {
    project     = var.project_name
    environment = var.environment
    managed_by  = "terraform"
  }

  base_env = {
    PORT                     = tostring(var.container_app_target_port)
    NODE_ENV                 = var.environment == "dev" ? "development" : "production"
    KEY_VAULT_URI            = var.key_vault_uri
    DATABASE_URL_SECRET_NAME = var.postgres_connection_secret_name
    JWT_SECRET_SECRET_NAME   = local.jwt_secret_name
    JWT_EXPIRES_IN           = "1h"
    JWT_REFRESH_EXPIRES_IN   = "7d"
    LOG_LEVEL                = var.environment == "dev" ? "debug" : "info"
    STORAGE_ACCOUNT_NAME     = var.storage_account_name
    STORAGE_BLOB_ENDPOINT    = var.storage_blob_endpoint
    DOCUMENTS_CONTAINER_NAME = var.documents_container_name
  }

  env_vars = merge(local.base_env, var.extra_env_vars)
}

resource "random_password" "jwt_secret" {
  length           = 64
  special          = true
  override_special = "_%@-"
}

resource "azurerm_key_vault_secret" "jwt_secret" {
  name         = local.jwt_secret_name
  value        = random_password.jwt_secret.result
  key_vault_id = var.key_vault_id
  content_type = "API JWT signing secret"
  tags         = local.tags
}

resource "azurerm_container_app_environment" "this" {
  name                       = local.container_app_environment_name
  location                   = var.location
  resource_group_name        = var.resource_group_name
  log_analytics_workspace_id = var.log_analytics_workspace_id
  tags                       = local.tags
}

resource "azurerm_container_app" "api" {
  name                         = local.api_app_name
  container_app_environment_id = azurerm_container_app_environment.this.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = local.tags

  identity {
    type         = "SystemAssigned, UserAssigned"
    identity_ids = [var.acr_pull_identity_id]
  }

  registry {
    server   = var.container_registry_login_server
    identity = var.acr_pull_identity_id
  }

  template {
    container {
      name   = "api"
      image  = "${var.container_registry_login_server}/${var.api_image_repository}:${var.api_image_tag}"
      cpu    = var.container_cpu
      memory = var.container_memory

      dynamic "env" {
        for_each = local.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }
    }

    min_replicas = var.min_replicas
    max_replicas = var.max_replicas
  }

  ingress {
    external_enabled = true
    target_port      = var.container_app_target_port
    transport        = "auto"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

data "azurerm_role_definition" "key_vault_secrets_user" {
  name  = "Key Vault Secrets User"
  scope = var.key_vault_id
}

resource "azurerm_role_assignment" "api_key_vault_secrets_user" {
  scope              = var.key_vault_id
  role_definition_id = data.azurerm_role_definition.key_vault_secrets_user.id
  principal_id       = azurerm_container_app.api.identity[0].principal_id
}

data "azurerm_storage_account" "app" {
  name                = var.storage_account_name
  resource_group_name = var.resource_group_name
}

data "azurerm_role_definition" "storage_blob_data_contributor" {
  name  = "Storage Blob Data Contributor"
  scope = data.azurerm_storage_account.app.id
}

resource "azurerm_role_assignment" "api_storage_blob_data_contributor" {
  scope              = data.azurerm_storage_account.app.id
  role_definition_id = data.azurerm_role_definition.storage_blob_data_contributor.id
  principal_id       = azurerm_container_app.api.identity[0].principal_id
}
