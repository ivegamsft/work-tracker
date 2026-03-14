output "api_container_app_name" {
  description = "API Container App name."
  value       = azurerm_container_app.api.name
}

output "api_url" {
  description = "Public API URL."
  value       = "https://${azurerm_container_app.api.ingress[0].fqdn}"
}
