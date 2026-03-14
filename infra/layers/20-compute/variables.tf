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

variable "app_service_sku" {
  description = "Azure App Service Plan SKU for the API workload."
  type        = string
  default     = "B1"
}

variable "node_version" {
  description = "Node.js runtime version for the Linux Web App."
  type        = string
  default     = "20-lts"
}

variable "app_command_line" {
  description = "Startup command executed by the Linux Web App."
  type        = string
  default     = "npm run start --workspace @e-clat/api"
}

variable "extra_app_settings" {
  description = "Additional application settings merged into the API web app settings."
  type        = map(string)
  default     = {}
}
