variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "location" {
  description = "Azure region for Container Apps resources."
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

variable "container_registry_login_server" {
  description = "ACR login server hostname."
  type        = string
}

variable "container_registry_id" {
  description = "ACR resource ID (available for future role assignments)."
  type        = string
}

variable "acr_pull_identity_id" {
  description = "User-assigned managed identity ID used for ACR pulls."
  type        = string
}

variable "api_image_repository" {
  description = "Container image repository for the API."
  type        = string
  default     = "api"
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

variable "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID for Container Apps."
  type        = string
}

variable "extra_env_vars" {
  description = "Additional environment variables merged into the API container."
  type        = map(string)
  default     = {}
}
