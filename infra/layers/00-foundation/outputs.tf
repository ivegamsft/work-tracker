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
