output "service_name" {
  description = "Compliance service deployment target name."
  value       = data.azurerm_container_app.shared.name
}

output "health_endpoint" {
  description = "Compliance service health check endpoint URL."
  value       = "https://${data.azurerm_container_app.shared.ingress[0].fqdn}/api/qualifications/health"
}

output "deploy_target" {
  description = "Container App resource ID for compliance service."
  value       = data.azurerm_container_app.shared.id
}
