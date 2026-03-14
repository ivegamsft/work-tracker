locals {
  storage_account_name = substr(lower(replace("${var.project_name}${var.environment}data", "-", "")), 0, 24)

  tags = {
    project     = var.project_name
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "azurerm_storage_account" "this" {
  name                            = local.storage_account_name
  resource_group_name             = var.resource_group_name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = var.account_replication_type
  account_kind                    = "StorageV2"
  min_tls_version                 = "TLS1_2"
  public_network_access_enabled   = true
  allow_nested_items_to_be_public = false
  tags                            = local.tags
}

resource "azurerm_storage_container" "documents" {
  name                  = var.documents_container_name
  storage_account_id    = azurerm_storage_account.this.id
  container_access_type = "private"
}
