variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "location" {
  description = "Azure region for the App Service resources."
  type        = string
}

variable "resource_group_name" {
  description = "Resource group where the compute resources will be created."
  type        = string
}

variable "project_name" {
  description = "Project slug used for resource naming."
  type        = string
  default     = "eclat"
}

variable "key_vault_id" {
  description = "Key Vault resource ID used for runtime secrets."
  type        = string
}

variable "key_vault_name" {
  description = "Key Vault name used for App Service Key Vault references."
  type        = string
}

variable "key_vault_uri" {
  description = "Key Vault URI exposed to the application runtime."
  type        = string
}

variable "postgres_connection_secret_name" {
  description = "Key Vault secret name that stores the PostgreSQL connection string."
  type        = string
}

variable "storage_account_name" {
  description = "Application storage account name."
  type        = string
}

variable "storage_blob_endpoint" {
  description = "Primary blob endpoint for the application storage account."
  type        = string
}

variable "documents_container_name" {
  description = "Blob container name for application documents."
  type        = string
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
