locals {
  backend_resource_group_name  = "${var.project_name}-${var.environment}-tfstate-rg"
  backend_storage_account_name = lower(replace("${var.project_name}tfstate${var.environment}", "-", ""))
}

data "terraform_remote_state" "foundation" {
  backend = "azurerm"

  config = {
    resource_group_name  = local.backend_resource_group_name
    storage_account_name = local.backend_storage_account_name
    container_name       = "tfstate"
    key                  = "foundation.tfstate"
  }
}

module "database" {
  source = "../../modules/database"

  environment         = var.environment
  location            = data.terraform_remote_state.foundation.outputs.location
  resource_group_name = data.terraform_remote_state.foundation.outputs.resource_group_name
  key_vault_id        = data.terraform_remote_state.foundation.outputs.key_vault_id
  project_name        = var.project_name
  db_sku              = var.db_sku
  database_name       = var.database_name
}

module "storage" {
  source = "../../modules/storage"

  environment              = var.environment
  location                 = data.terraform_remote_state.foundation.outputs.location
  resource_group_name      = data.terraform_remote_state.foundation.outputs.resource_group_name
  project_name             = var.project_name
  documents_container_name = var.documents_container_name
}
