variable "project_name" {
  type        = string
  description = "Project name used for resource naming"
  default     = "e-clat"
}

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "region" {
  type        = string
  description = "Azure region for resources"
  default     = "eastus"
}

variable "resource_group_name" {
  type        = string
  description = "Resource group name from foundation layer"
}

variable "key_vault_id" {
  type        = string
  description = "Key Vault ID from foundation layer for storing promotion secrets"
}

variable "container_registry_id" {
  type        = string
  description = "Container registry ID from foundation layer"
  default     = ""
}

variable "artifact_retention_days" {
  type        = number
  description = "Artifact retention in days per environment"
  default     = 90
}

variable "enable_geo_replication" {
  type        = bool
  description = "Enable geo-replication for production artifacts"
  default     = false
}

variable "promotion_approval_required" {
  type        = bool
  description = "Require manual approval for promotions to this environment"
  default     = false
}

variable "common_tags" {
  type        = map(string)
  description = "Common tags applied to all resources"
  default     = {}
}
