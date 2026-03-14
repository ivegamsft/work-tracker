output "api_container_app_name" {
  description = "API Container App name."
  value       = module.compute.api_container_app_name
}

output "api_url" {
  description = "Public API URL."
  value       = module.compute.api_url
}
