# Keep compute output names aligned with downstream consumers by preserving the
# resource type in the contract (for example, *_container_app_name).
output "api_container_app_name" {
  description = "API Container App name."
  value       = module.compute.api_container_app_name
}

output "api_url" {
  description = "Public API URL."
  value       = module.compute.api_url
}
