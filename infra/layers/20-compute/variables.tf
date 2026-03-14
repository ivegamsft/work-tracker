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

variable "api_image_tag" {
  description = "Container image tag for the API."
  type        = string
  default     = "latest"
}

variable "container_app_target_port" {
  description = "Container port exposed by the API container."
  type        = number
  default     = 8080
}

variable "container_cpu" {
  description = "CPU cores allocated per container."
  type        = number
  default     = 0.5
}

variable "container_memory" {
  description = "Memory allocated per container."
  type        = string
  default     = "1Gi"
}

variable "min_replicas" {
  description = "Minimum number of container replicas."
  type        = number
  default     = 1
}

variable "max_replicas" {
  description = "Maximum number of container replicas."
  type        = number
  default     = 2
}

variable "extra_env_vars" {
  description = "Additional environment variables merged into the API container."
  type        = map(string)
  default     = {}
}
