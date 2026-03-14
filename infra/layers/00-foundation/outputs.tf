output "resource_group_name" {
  description = "Environment resource group name."
  value       = module.foundation.resource_group_name
}

output "location" {
  description = "Azure region used for the environment."
  value       = module.foundation.location
}

output "key_vault_name" {
  description = "Key Vault name for shared environment secrets."
  value       = module.foundation.key_vault_name
}

output "key_vault_id" {
  description = "Key Vault resource ID."
  value       = module.foundation.key_vault_id
}

output "key_vault_uri" {
  description = "Key Vault URI."
  value       = module.foundation.key_vault_uri
}

output "container_registry_id" {
  description = "Azure Container Registry resource ID."
  value       = module.foundation.container_registry_id
}

output "container_registry_name" {
  description = "Azure Container Registry name."
  value       = module.foundation.container_registry_name
}

output "container_registry_login_server" {
  description = "Azure Container Registry login server."
  value       = module.foundation.container_registry_login_server
}

output "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID for Container Apps."
  value       = module.foundation.log_analytics_workspace_id
}

output "acr_pull_identity_id" {
  description = "User-assigned managed identity ID for ACR pulls."
  value       = module.foundation.acr_pull_identity_id
}

output "acr_pull_identity_client_id" {
  description = "Client ID for the ACR pull user-assigned identity."
  value       = module.foundation.acr_pull_identity_client_id
}
