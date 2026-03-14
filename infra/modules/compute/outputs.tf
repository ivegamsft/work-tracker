output "api_app_name" {
  description = "API App Service name."
  value       = azurerm_linux_web_app.api.name
}

output "api_default_hostname" {
  description = "Default hostname assigned to the API App Service."
  value       = azurerm_linux_web_app.api.default_hostname
}

output "api_url" {
  description = "Public API URL."
  value       = "https://${azurerm_linux_web_app.api.default_hostname}"
}

output "api_principal_id" {
  description = "System-assigned managed identity principal ID for the API App Service."
  value       = azurerm_linux_web_app.api.identity[0].principal_id
}
