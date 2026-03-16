output "service_name" {
  description = "Notifications service deployment target name."
  value       = data.azurerm_container_app.shared.name
}

output "health_endpoint" {
  description = "Notifications service health check endpoint URL."
  value       = "https://${data.azurerm_container_app.shared.ingress[0].fqdn}/api/notifications/health"
}

output "deploy_target" {
  description = "Container App resource ID for notifications service."
  value       = data.azurerm_container_app.shared.id
}
