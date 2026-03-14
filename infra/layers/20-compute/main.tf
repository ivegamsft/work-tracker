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

data "terraform_remote_state" "data" {
  backend = "azurerm"

  config = {
    resource_group_name  = local.backend_resource_group_name
    storage_account_name = local.backend_storage_account_name
    container_name       = "tfstate"
    key                  = "data.tfstate"
  }
}

module "compute" {
  source = "../../modules/compute"

  environment                     = var.environment
  location                        = data.terraform_remote_state.foundation.outputs.location
  resource_group_name             = data.terraform_remote_state.foundation.outputs.resource_group_name
  project_name                    = var.project_name
  key_vault_id                    = data.terraform_remote_state.foundation.outputs.key_vault_id
  key_vault_name                  = data.terraform_remote_state.foundation.outputs.key_vault_name
  key_vault_uri                   = data.terraform_remote_state.foundation.outputs.key_vault_uri
  postgres_connection_secret_name = data.terraform_remote_state.data.outputs.postgres_connection_secret_name
  storage_account_name            = data.terraform_remote_state.data.outputs.storage_account_name
  storage_blob_endpoint           = data.terraform_remote_state.data.outputs.storage_blob_endpoint
  documents_container_name        = data.terraform_remote_state.data.outputs.documents_container_name
  app_service_sku                 = var.app_service_sku
  node_version                    = var.node_version
  app_command_line                = var.app_command_line
  extra_app_settings              = var.extra_app_settings
}
