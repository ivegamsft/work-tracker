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
  key_vault_uri                   = data.terraform_remote_state.foundation.outputs.key_vault_uri
  postgres_connection_secret_name = data.terraform_remote_state.data.outputs.postgres_connection_secret_name
  storage_account_name            = data.terraform_remote_state.data.outputs.storage_account_name
  storage_blob_endpoint           = data.terraform_remote_state.data.outputs.storage_blob_endpoint
  documents_container_name        = data.terraform_remote_state.data.outputs.documents_container_name
  container_registry_id           = data.terraform_remote_state.foundation.outputs.container_registry_id
  container_registry_login_server = data.terraform_remote_state.foundation.outputs.container_registry_login_server
  log_analytics_workspace_id      = data.terraform_remote_state.foundation.outputs.log_analytics_workspace_id
  acr_pull_identity_id            = data.terraform_remote_state.foundation.outputs.acr_pull_identity_id
  api_image_tag                   = var.api_image_tag
  container_app_target_port       = var.container_app_target_port
  container_cpu                   = var.container_cpu
  container_memory                = var.container_memory
  min_replicas                    = var.min_replicas
  max_replicas                    = var.max_replicas
  extra_env_vars                  = var.extra_env_vars
}

# ---------------------------------------------------------------------------
# Service-group compute modules
# Each stub references the shared Container App deployed above.
# When a service is extracted, its module will create a dedicated Container App.
# ---------------------------------------------------------------------------

module "compute_identity" {
  source = "../../modules/compute-identity"

  environment         = var.environment
  project_name        = var.project_name
  resource_group_name = data.terraform_remote_state.foundation.outputs.resource_group_name
  container_app_name  = module.compute.api_container_app_name
}

module "compute_workforce" {
  source = "../../modules/compute-workforce"

  environment         = var.environment
  project_name        = var.project_name
  resource_group_name = data.terraform_remote_state.foundation.outputs.resource_group_name
  container_app_name  = module.compute.api_container_app_name
}

module "compute_compliance" {
  source = "../../modules/compute-compliance"

  environment         = var.environment
  project_name        = var.project_name
  resource_group_name = data.terraform_remote_state.foundation.outputs.resource_group_name
  container_app_name  = module.compute.api_container_app_name
}

module "compute_records" {
  source = "../../modules/compute-records"

  environment         = var.environment
  project_name        = var.project_name
  resource_group_name = data.terraform_remote_state.foundation.outputs.resource_group_name
  container_app_name  = module.compute.api_container_app_name
}

module "compute_reference" {
  source = "../../modules/compute-reference"

  environment         = var.environment
  project_name        = var.project_name
  resource_group_name = data.terraform_remote_state.foundation.outputs.resource_group_name
  container_app_name  = module.compute.api_container_app_name
}

module "compute_notifications" {
  source = "../../modules/compute-notifications"

  environment         = var.environment
  project_name        = var.project_name
  resource_group_name = data.terraform_remote_state.foundation.outputs.resource_group_name
  container_app_name  = module.compute.api_container_app_name
}
