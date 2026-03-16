output "service_name" {
  description = "Logical service name for the notifications service group."
  value       = local.service_key
}

output "health_endpoint" {
  description = "Health-check path for the notifications service group."
  value       = "/api/notifications/health"
}

output "deploy_target" {
  description = "Container App name used for deployments."
  value       = data.azurerm_container_app.shared.name
}
