terraform {
  required_providers {
    azurerm = {
      source = "hashicorp/azurerm"
    }
    random = {
      source = "hashicorp/random"
    }
  }
}

locals {
  name_prefix            = "${var.project_name}-${var.environment}"
  server_name            = "${local.name_prefix}-postgres"
  administrator_login    = coalesce(var.administrator_login, substr(lower(replace("${var.project_name}${var.environment}admin", "-", "")), 0, 16))
  connection_secret_name = "${local.name_prefix}-postgres-connection"

  tags = {
    project     = var.project_name
    environment = var.environment
    managed_by  = "terraform"
  }

  connection_string = format(
    "postgresql://%s:%s@%s:5432/%s?sslmode=require",
    urlencode(local.administrator_login),
    urlencode(random_password.administrator.result),
    azurerm_postgresql_flexible_server.this.fqdn,
    azurerm_postgresql_flexible_server_database.this.name,
  )
}

resource "random_password" "administrator" {
  length           = 32
  special          = true
  override_special = "_%@-"
}

resource "azurerm_postgresql_flexible_server" "this" {
  name                          = local.server_name
  resource_group_name           = var.resource_group_name
  location                      = var.location
  version                       = var.postgres_version
  administrator_login           = local.administrator_login
  administrator_password        = random_password.administrator.result
  sku_name                      = var.db_sku
  storage_mb                    = var.storage_mb
  backup_retention_days         = 7
  public_network_access_enabled = true
  tags                          = local.tags
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.this.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_postgresql_flexible_server_database" "this" {
  name      = var.database_name
  server_id = azurerm_postgresql_flexible_server.this.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_key_vault_secret" "connection_string" {
  name         = local.connection_secret_name
  value        = local.connection_string
  key_vault_id = var.key_vault_id
  content_type = "PostgreSQL connection string"
  tags         = local.tags
}
