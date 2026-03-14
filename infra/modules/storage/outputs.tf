output "storage_account_name" {
  description = "Storage account name for application data."
  value       = azurerm_storage_account.this.name
}

output "storage_blob_endpoint" {
  description = "Primary blob endpoint for the storage account."
  value       = azurerm_storage_account.this.primary_blob_endpoint
}

output "documents_container_name" {
  description = "Documents blob container name."
  value       = azurerm_storage_container.documents.name
}
