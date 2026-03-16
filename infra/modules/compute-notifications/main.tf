terraform {
  required_providers {
    azurerm = {
      source = "hashicorp/azurerm"
    }
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  service_key = "notifications"
  api_modules = "notifications"

  tags = {
    project     = var.project_name
    environment = var.environment
    service     = local.service_key
    managed_by  = "terraform"
  }
}

# Placeholder: Currently deploys to shared Container App (passed via var.container_app_name)
# Future: Will create dedicated azurerm_container_app resource for notification services
# Service group: notifications

data "azurerm_container_app" "shared" {
  name                = var.container_app_name
  resource_group_name = var.resource_group_name
}

# --- Future: dedicated Container App for notifications service ---
# resource "azurerm_container_app" "notifications" {
#   name                         = "${local.name_prefix}-${local.service_key}-api"
#   container_app_environment_id = var.container_app_environment_id
#   resource_group_name          = var.resource_group_name
#   revision_mode                = "Single"
#   tags                         = local.tags
#
#   identity {
#     type         = "SystemAssigned, UserAssigned"
#     identity_ids = [var.acr_pull_identity_id]
#   }
#
#   registry {
#     server   = var.container_registry_login_server
#     identity = var.acr_pull_identity_id
#   }
#
#   template {
#     container {
#       name   = local.service_key
#       image  = "${var.container_registry_login_server}/${var.image_repository}:${var.image_tag}"
#       cpu    = var.container_cpu
#       memory = var.container_memory
#     }
#     min_replicas = var.min_replicas
#     max_replicas = var.max_replicas
#   }
#
#   ingress {
#     external_enabled = true
#     target_port      = var.container_app_target_port
#     transport        = "auto"
#     traffic_weight {
#       percentage      = 100
#       latest_revision = true
#     }
#   }
# }
