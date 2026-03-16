terraform {
  required_providers {
    azurerm = {
      source = "hashicorp/azurerm"
    }
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  service_key = "workforce"

  tags = {
    project     = var.project_name
    environment = var.environment
    service     = local.service_key
    managed_by  = "terraform"
  }
}

# Placeholder: Currently deploys to shared Container App (passed via var.container_app_name)
# Future: Will create dedicated azurerm_container_app resource for workforce services
# Service group: employees

data "azurerm_container_app" "shared" {
  name                = var.container_app_name
  resource_group_name = var.resource_group_name
}

# Future extraction: When independent deployment is needed, replace data source with:
# resource "azurerm_container_app" "workforce" { ... }
