output "promotion_layer_status" {
  description = "Status of promotion layer implementation"
  value       = "implemented"
}

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
