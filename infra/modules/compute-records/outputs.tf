output "service_name" {
  description = "Logical service name for the records service group."
  value       = local.service_key
}

output "health_endpoint" {
  description = "Health-check path for the records service group."
  value       = "/api/documents/health"
}

output "deploy_target" {
  description = "Container App name used for deployments."
  value       = data.azurerm_container_app.shared.name
}
