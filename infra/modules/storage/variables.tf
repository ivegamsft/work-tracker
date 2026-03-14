variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "location" {
  description = "Azure region for the storage account."
  type        = string
}

variable "resource_group_name" {
  description = "Resource group where the storage account will be created."
  type        = string
}

variable "project_name" {
  description = "Project slug used for resource naming."
  type        = string
  default     = "eclat"
}

variable "account_replication_type" {
  description = "Storage account replication type."
  type        = string
  default     = "LRS"

  validation {
    condition     = contains(["LRS", "GRS", "RAGRS", "ZRS", "GZRS", "RAGZRS"], var.account_replication_type)
    error_message = "account_replication_type must be a supported Azure replication type."
  }
}

variable "documents_container_name" {
  description = "Blob container name used for application documents."
  type        = string
  default     = "documents"

  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$", var.documents_container_name))
    error_message = "documents_container_name must be a valid Azure blob container name."
  }
}
