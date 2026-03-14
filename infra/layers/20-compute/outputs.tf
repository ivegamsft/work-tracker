output "api_app_name" {
  description = "API App Service name."
  value       = module.compute.api_app_name
}

output "api_url" {
  description = "Public API URL."
  value       = module.compute.api_url
}


