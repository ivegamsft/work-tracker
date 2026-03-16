variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Project slug used for resource naming."
  type        = string
  default     = "eclat"
}

variable "resource_group_name" {
  description = "Resource group where the compute resources are located."
  type        = string
}

variable "container_app_name" {
  description = "Name of the shared Container App (used until independent deployment)."
  type        = string

  validation {
    condition     = length(var.container_app_name) > 0
    error_message = "container_app_name must not be empty."
  }
}

# Future independent deployment variables (commented for now)
# variable "container_app_environment_id" {
#   description = "Container App Environment ID for identity service."
#   type        = string
# }
#
# variable "container_registry_login_server" {
#   description = "ACR login server hostname."
#   type        = string
# }
#
# variable "acr_pull_identity_id" {
#   description = "User-assigned managed identity ID used for ACR pulls."
#   type        = string
# }
#
# variable "image_repository" {
#   description = "Container image repository for identity services."
#   type        = string
#   default     = "identity-api"
# }
#
# variable "image_tag" {
#   description = "Container image tag for identity services."
#   type        = string
#   default     = "latest"
# }
#
# variable "container_app_target_port" {
#   description = "Container port exposed by the identity service."
#   type        = number
#   default     = 8080
# }
#
# variable "container_cpu" {
#   description = "CPU cores allocated per container."
#   type        = number
#   default     = 0.5
# }
#
# variable "container_memory" {
#   description = "Memory allocated per container."
#   type        = string
#   default     = "1Gi"
# }
#
# variable "min_replicas" {
#   description = "Minimum number of container replicas."
#   type        = number
#   default     = 1
# }
#
# variable "max_replicas" {
#   description = "Maximum number of container replicas."
#   type        = number
#   default     = 2
# }
