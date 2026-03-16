output "service_name" {
  description = "Workforce service deployment target name."
  value       = data.azurerm_container_app.shared.name
}

output "health_endpoint" {
  description = "Workforce service health check endpoint URL."
  value       = "https://${data.azurerm_container_app.shared.ingress[0].fqdn}/api/employees/health"
}

output "deploy_target" {
  description = "Container App resource ID for workforce service."
  value       = data.azurerm_container_app.shared.id
}
