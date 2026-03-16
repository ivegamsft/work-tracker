output "service_name" {
  description = "Reference service deployment target name."
  value       = data.azurerm_container_app.shared.name
}

output "health_endpoint" {
  description = "Reference service health check endpoint URL."
  value       = "https://${data.azurerm_container_app.shared.ingress[0].fqdn}/api/standards/health"
}

output "deploy_target" {
  description = "Container App resource ID for reference service."
  value       = data.azurerm_container_app.shared.id
}
