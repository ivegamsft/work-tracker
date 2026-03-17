# 30-promotion — Artifact Promotion Infrastructure
#
# This layer manages artifact promotion pipeline infrastructure:
# - Environment-specific promotion metadata storage
# - Promotion gates and approval workflows
# - Artifact versioning and immutability guarantees
# - Audit logging and rollback capability infrastructure
#
# Strategy: SHA-based immutable image tags promoted across environments
# Example: sha-abc123 → dev-abc123 → staging-abc123 → prod-abc123
#
# Promotion path: dev → staging → prod (linear, no direct dev→prod)

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

locals {
  environment = var.environment
  region      = var.region
  tags = merge(
    var.common_tags,
    {
      Module      = "promotion"
      Environment = local.environment
    }
  )
}

# Artifact metadata storage: track promotions across environments
resource "azurerm_storage_account" "promotion_metadata" {
  name                     = "eclat${replace(local.environment, "-", "")}prom${random_string.storage_suffix.result}"
  resource_group_name      = var.resource_group_name
  location                 = local.region
  account_tier             = "Standard"
  account_replication_type = "LRS"

  tags = local.tags
}

resource "random_string" "storage_suffix" {
  length  = 4
  special = false
  lower   = true
}

# Container for promotion audit logs
resource "azurerm_storage_container" "promotion_audit" {
  name                  = "promotion-audit"
  storage_account_name  = azurerm_storage_account.promotion_metadata.name
  container_access_type = "private"
}

# Container for artifact metadata (manifests, tags, signatures)
resource "azurerm_storage_container" "artifact_metadata" {
  name                  = "artifact-metadata"
  storage_account_name  = azurerm_storage_account.promotion_metadata.name
  container_access_type = "private"
}

# Log Analytics workspace for promotion audit trail
resource "azurerm_log_analytics_workspace" "promotion_logs" {
  name                = "eclat-promotion-${local.environment}"
  location            = local.region
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = local.environment == "prod" ? 180 : 30

  tags = local.tags
}

# Key Vault access for promotion secrets (artifact signing keys, registry credentials)
resource "azurerm_key_vault_secret" "promotion_signing_key" {
  name            = "promotion-signing-key-${local.environment}"
  value           = "placeholder-${local.environment}-signing-key"
  key_vault_id    = var.key_vault_id
  expiration_date = timeadd(timestamp(), "8760h") # 1 year

  lifecycle {
    ignore_changes = [value, expiration_date]
  }

  tags = local.tags
}

# Promotion gates per environment
# These serve as documented state and can feed Azure Policy or custom approvals
resource "azurerm_resource_group" "promotion_gates" {
  name     = "eclat-promotion-gates-${local.environment}"
  location = local.region

  tags = local.tags
}

# Outputs for GitHub Actions workflow reference
output "promotion_metadata_storage" {
  value       = azurerm_storage_account.promotion_metadata.id
  description = "Storage account for promotion metadata and audit logs"
}

output "promotion_audit_container" {
  value       = azurerm_storage_container.promotion_audit.name
  description = "Container name for promotion audit logs"
}

output "artifact_metadata_container" {
  value       = azurerm_storage_container.artifact_metadata.name
  description = "Container name for artifact metadata"
}

output "promotion_logs_workspace_id" {
  value       = azurerm_log_analytics_workspace.promotion_logs.id
  description = "Log Analytics workspace for promotion audit trail"
}

output "promotion_logs_workspace_name" {
  value       = azurerm_log_analytics_workspace.promotion_logs.name
  description = "Log Analytics workspace name for KQL queries"
}

output "signing_key_vault_secret_id" {
  value       = azurerm_key_vault_secret.promotion_signing_key.id
  description = "Key Vault secret ID for artifact signing"
  sensitive   = true
}
