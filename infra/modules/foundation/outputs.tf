output "resource_group_name" {
  description = "Environment resource group name."
  value       = azurerm_resource_group.this.name
}

output "resource_group_id" {
  description = "Environment resource group ID."
  value       = azurerm_resource_group.this.id
}

output "location" {
  description = "Azure region used for the environment."
  value       = azurerm_resource_group.this.location
}

output "key_vault_name" {
  description = "Key Vault name for shared environment secrets."
  value       = azurerm_key_vault.this.name
}

output "key_vault_id" {
  description = "Key Vault resource ID."
  value       = azurerm_key_vault.this.id
}

output "key_vault_uri" {
  description = "Key Vault vault URI."
  value       = azurerm_key_vault.this.vault_uri
}

output "container_registry_id" {
  description = "Azure Container Registry resource ID."
  value       = azurerm_container_registry.this.id
}

output "container_registry_name" {
  description = "Azure Container Registry name."
  value       = azurerm_container_registry.this.name
}

output "container_registry_login_server" {
  description = "Azure Container Registry login server."
  value       = azurerm_container_registry.this.login_server
}

output "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID for Container Apps."
  value       = azurerm_log_analytics_workspace.this.id
}

output "acr_pull_identity_id" {
  description = "User-assigned managed identity ID for ACR pulls."
  value       = azurerm_user_assigned_identity.acr_pull.id
}

output "acr_pull_identity_client_id" {
  description = "Client ID for the ACR pull user-assigned identity."
  value       = azurerm_user_assigned_identity.acr_pull.client_id
}
