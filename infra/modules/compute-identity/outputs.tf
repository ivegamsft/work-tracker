output "service_name" {
  description = "Identity service deployment target name."
  value       = data.azurerm_container_app.shared.name
}

output "health_endpoint" {
  description = "Identity service health check endpoint URL."
  value       = "https://${data.azurerm_container_app.shared.ingress[0].fqdn}/api/auth/health"
}

output "deploy_target" {
  description = "Container App resource ID for identity service."
  value       = data.azurerm_container_app.shared.id
}

# Future outputs when independently deployed:
# output "service_name" {
#   description = "Identity service deployment target name."
#   value       = azurerm_container_app.identity.name
# }
#
# output "health_endpoint" {
#   description = "Identity service health check endpoint URL."
#   value       = "https://${azurerm_container_app.identity.ingress[0].fqdn}/health"
# }
#
# output "deploy_target" {
#   description = "Container App resource ID for identity service."
#   value       = azurerm_container_app.identity.id
# }
