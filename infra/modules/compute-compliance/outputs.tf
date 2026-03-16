output "service_name" {
  description = "Logical service name for the compliance service group."
  value       = local.service_key
}

output "health_endpoint" {
  description = "Health-check path for the compliance service group."
  value       = "/api/qualifications/health"
}

output "deploy_target" {
  description = "Container App name used for deployments."
  value       = data.azurerm_container_app.shared.name
}
