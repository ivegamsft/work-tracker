variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "location" {
  description = "Azure region for the PostgreSQL server."
  type        = string
}

variable "resource_group_name" {
  description = "Resource group where the PostgreSQL server will be created."
  type        = string
}

variable "key_vault_id" {
  description = "Key Vault resource ID used to store the database connection string."
  type        = string
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
  description = "Application database name to create on the PostgreSQL server."
  type        = string
  default     = "eclat"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.database_name))
    error_message = "database_name must start with a letter and contain only letters, numbers, and underscores."
  }
}

variable "postgres_version" {
  description = "PostgreSQL major version for the flexible server."
  type        = string
  default     = "16"
}

variable "storage_mb" {
  description = "Allocated storage in MB for the flexible server."
  type        = number
  default     = 32768

  validation {
    condition     = var.storage_mb >= 32768
    error_message = "storage_mb must be at least 32768 MB."
  }
}

variable "administrator_login" {
  description = "Optional administrator username override for the PostgreSQL server."
  type        = string
  default     = null
}
