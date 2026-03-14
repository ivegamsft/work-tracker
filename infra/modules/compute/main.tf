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

data "azurerm_client_config" "current" {}

locals {
  name_prefix       = "${var.project_name}-${var.environment}"
  service_plan_name = "${local.name_prefix}-api-plan"
  app_name          = "${local.name_prefix}-api"
  jwt_secret_name   = "${local.name_prefix}-jwt-secret"

  tags = {
    project     = var.project_name
    environment = var.environment
    managed_by  = "terraform"
  }

  database_url_reference = "@Microsoft.KeyVault(VaultName=${var.key_vault_name};SecretName=${var.postgres_connection_secret_name})"
  jwt_secret_reference   = "@Microsoft.KeyVault(VaultName=${var.key_vault_name};SecretName=${azurerm_key_vault_secret.jwt_secret.name})"
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

resource "azurerm_service_plan" "this" {
  name                = local.service_plan_name
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Linux"
  sku_name            = var.app_service_sku
  tags                = local.tags
}

resource "azurerm_linux_web_app" "api" {
  name                = local.app_name
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = azurerm_service_plan.this.id
  https_only          = true
  tags                = local.tags

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on         = true
    app_command_line  = var.app_command_line
    ftps_state        = "Disabled"
    health_check_path = "/health"

    application_stack {
      node_version = var.node_version
    }
  }

  app_settings = merge(
    {
      DATABASE_URL                   = local.database_url_reference
      JWT_SECRET                     = local.jwt_secret_reference
      JWT_EXPIRES_IN                 = "1h"
      JWT_REFRESH_EXPIRES_IN         = "7d"
      KEY_VAULT_URI                  = var.key_vault_uri
      STORAGE_ACCOUNT_NAME           = var.storage_account_name
      STORAGE_BLOB_ENDPOINT          = var.storage_blob_endpoint
      DOCUMENTS_CONTAINER_NAME       = var.documents_container_name
      DOCUMENT_PROCESSOR             = "azure-form-recognizer"
      LOG_LEVEL                      = var.environment == "dev" ? "debug" : "info"
      NODE_ENV                       = var.environment == "dev" ? "development" : "production"
      PORT                           = "8080"
      WEBSITES_PORT                  = "8080"
      ENABLE_ORYX_BUILD              = "true"
      SCM_DO_BUILD_DURING_DEPLOYMENT = "true"
    },
    var.extra_app_settings,
  )
}

resource "azurerm_key_vault_access_policy" "app" {
  key_vault_id = var.key_vault_id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_linux_web_app.api.identity[0].principal_id

  secret_permissions = [
    "Get",
    "List",
  ]
}
