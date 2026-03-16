output "service_name" {
  description = "Logical service name for the identity service group."
  value       = local.service_key
}

output "health_endpoint" {
  description = "Health-check path for the identity service group."
  value       = "/api/auth/health"
}

output "deploy_target" {
  description = "Container App name used for deployments."
  value       = data.azurerm_container_app.shared.name
}

# Future outputs when independently deployed:
# output "deploy_target" {
#   value = azurerm_container_app.identity.name
# }
