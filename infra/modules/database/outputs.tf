output "postgres_fqdn" {
  description = "Fully qualified domain name of the PostgreSQL server."
  value       = azurerm_postgresql_flexible_server.this.fqdn
}

output "postgres_database_name" {
  description = "Application database name."
  value       = azurerm_postgresql_flexible_server_database.this.name
}

output "postgres_connection_secret_name" {
  description = "Key Vault secret name containing the PostgreSQL connection string."
  value       = azurerm_key_vault_secret.connection_string.name
}
