output "service_name" {
  description = "Logical service name for the reference service group."
  value       = local.service_key
}

output "health_endpoint" {
  description = "Health-check path for the reference service group."
  value       = "/api/standards/health"
}

output "deploy_target" {
  description = "Container App name used for deployments."
  value       = data.azurerm_container_app.shared.name
}
