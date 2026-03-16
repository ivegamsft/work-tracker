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

# Shared Container App reference (current state)
variable "container_app_name" {
  description = "Name of the shared Container App (used until independent deployment)."
  type        = string
}
