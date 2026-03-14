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

variable "db_sku" {
  description = "Azure Database for PostgreSQL Flexible Server SKU name."
  type        = string
}

variable "database_name" {
  description = "Application database name to create."
  type        = string
  default     = "eclat"
}

variable "documents_container_name" {
  description = "Blob container name for application documents."
  type        = string
  default     = "documents"
}
