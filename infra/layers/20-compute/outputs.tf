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

# ---------------------------------------------------------------------------
# Service-group outputs
# ---------------------------------------------------------------------------

output "identity_service" {
  description = "Identity service group outputs."
  value = {
    service_name    = module.compute_identity.service_name
    health_endpoint = module.compute_identity.health_endpoint
    deploy_target   = module.compute_identity.deploy_target
  }
}

output "workforce_service" {
  description = "Workforce service group outputs."
  value = {
    service_name    = module.compute_workforce.service_name
    health_endpoint = module.compute_workforce.health_endpoint
    deploy_target   = module.compute_workforce.deploy_target
  }
}

output "compliance_service" {
  description = "Compliance service group outputs."
  value = {
    service_name    = module.compute_compliance.service_name
    health_endpoint = module.compute_compliance.health_endpoint
    deploy_target   = module.compute_compliance.deploy_target
  }
}

output "records_service" {
  description = "Records service group outputs."
  value = {
    service_name    = module.compute_records.service_name
    health_endpoint = module.compute_records.health_endpoint
    deploy_target   = module.compute_records.deploy_target
  }
}

output "reference_service" {
  description = "Reference service group outputs."
  value = {
    service_name    = module.compute_reference.service_name
    health_endpoint = module.compute_reference.health_endpoint
    deploy_target   = module.compute_reference.deploy_target
  }
}

output "notifications_service" {
  description = "Notifications service group outputs."
  value = {
    service_name    = module.compute_notifications.service_name
    health_endpoint = module.compute_notifications.health_endpoint
    deploy_target   = module.compute_notifications.deploy_target
  }
}
