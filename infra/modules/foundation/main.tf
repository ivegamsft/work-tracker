data "azurerm_client_config" "current" {}

locals {
  name_prefix                 = "${var.project_name}-${var.environment}"
  resource_group_name         = "${local.name_prefix}-rg"
  key_vault_name              = "${local.name_prefix}-kv"
  container_registry_name     = lower(replace("${var.project_name}${var.environment}acr", "-", ""))
  log_analytics_workspace_name = "${local.name_prefix}-law"
  acr_pull_identity_name      = "${local.name_prefix}-acr-pull"

  tags = {
    project     = var.project_name
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "azurerm_resource_group" "this" {
  name     = local.resource_group_name
  location = var.location
  tags     = local.tags
}

resource "azurerm_key_vault" "this" {
  name                          = local.key_vault_name
  location                      = azurerm_resource_group.this.location
  resource_group_name           = azurerm_resource_group.this.name
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  soft_delete_retention_days    = 7
  purge_protection_enabled      = false
  public_network_access_enabled = true
  enabled_for_deployment        = true
  rbac_authorization_enabled    = true

  tags = local.tags
}

resource "azurerm_container_registry" "this" {
  name                = local.container_registry_name
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  sku                 = "Standard"
  admin_enabled       = false
  tags                = local.tags
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = local.log_analytics_workspace_name
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_user_assigned_identity" "acr_pull" {
  name                = local.acr_pull_identity_name
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  tags                = local.tags
}

data "azurerm_role_definition" "acr_pull" {
  name  = "AcrPull"
  scope = azurerm_container_registry.this.id
}

resource "azurerm_role_assignment" "acr_pull" {
  scope              = azurerm_container_registry.this.id
  role_definition_id = data.azurerm_role_definition.acr_pull.id
  principal_id       = azurerm_user_assigned_identity.acr_pull.principal_id
}

data "azurerm_role_definition" "key_vault_secrets_officer" {
  name  = "Key Vault Secrets Officer"
  scope = azurerm_key_vault.this.id
}

resource "azurerm_role_assignment" "deploy_key_vault_secrets_officer" {
  scope              = azurerm_key_vault.this.id
  role_definition_id = data.azurerm_role_definition.key_vault_secrets_officer.id
  principal_id       = data.azurerm_client_config.current.object_id
}
