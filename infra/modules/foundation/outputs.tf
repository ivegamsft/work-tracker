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
