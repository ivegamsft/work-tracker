variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "location" {
  description = "Azure region for the environment foundation resources."
  type        = string
  default     = "eastus2"
}

variable "project_name" {
  description = "Project slug used for resource naming."
  type        = string
  default     = "eclat"
}
