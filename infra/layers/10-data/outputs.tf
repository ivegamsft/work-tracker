output "postgres_connection_secret_name" {
  description = "Key Vault secret name containing the PostgreSQL connection string."
  value       = module.database.postgres_connection_secret_name
}

output "storage_account_name" {
  description = "Application storage account name."
  value       = module.storage.storage_account_name
}

output "storage_blob_endpoint" {
  description = "Application storage blob endpoint."
  value       = module.storage.storage_blob_endpoint
}

output "documents_container_name" {
  description = "Documents blob container name."
  value       = module.storage.documents_container_name
}
