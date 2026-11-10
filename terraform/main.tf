# Variables / Locals
locals {
  acr_name           = "nexusbijok2026"
  container_app_name = "nexus-app"
  environment_name   = "nexus-environment"
  log_analytics_name = "workspace-rgnexusdevBQOx"
}

# Resource Group
module "resource_group" {
  source = "./modules/resource-group"

  resource_group_name = var.resource_group_name
  location            = var.location
  environment         = var.environment
  owner               = var.owner
  project_name        = var.project_name
}

moved {
  from = azurerm_resource_group.rg
  to   = module.resource_group.azurerm_resource_group.rg
}

# Azure Container Registry
resource "azurerm_container_registry" "acr" {
  name                = local.acr_name
  resource_group_name = module.resource_group.resource_group_name
  location            = module.resource_group.resource_group_location
  sku                 = "Basic"
  admin_enabled       = false
}

# Log Analytics Workspace for Container Apps Environment
resource "azurerm_log_analytics_workspace" "logs" {
  name                = local.log_analytics_name
  location            = module.resource_group.resource_group_location
  resource_group_name = module.resource_group.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

# Container Apps Managed Environment
resource "azurerm_container_app_environment" "env" {
  name                       = local.environment_name
  location                   = module.resource_group.resource_group_location
  resource_group_name        = module.resource_group.resource_group_name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id

  # Azure API does not return log_analytics_workspace_id on read/import.
  lifecycle {
    ignore_changes = [log_analytics_workspace_id]
  }
}

# Azure Container App
resource "azurerm_container_app" "app" {
  name                         = local.container_app_name
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = module.resource_group.resource_group_name
  revision_mode                = "Multiple"
  workload_profile_name        = "Consumption"

  identity {
    type = "SystemAssigned"
  }

  template {
    container {
      name   = "nexus-app"
      image  = "${azurerm_container_registry.acr.login_server}/nexus:BUILD_TAG"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name        = "SUPABASE_URL"
        secret_name = "supabase-url"
      }

      env {
        name        = "SUPABASE_PUBLISHABLE_KEY"
        secret_name = "supabase-publishable-key"
      }

      env {
        name  = "HOST"
        value = "0.0.0.0"
      }

      env {
        name  = "PORT"
        value = "3000"
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
    }

    min_replicas = 0
    max_replicas = 10
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    transport        = "auto"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  registry {
    server   = azurerm_container_registry.acr.login_server
    identity = "system"
  }

  # Secret values are not returned by Azure on import; keep existing secrets untouched.
  secret {
    name  = "supabase-url"
    value = "managed-in-azure"
  }

  secret {
    name  = "supabase-publishable-key"
    value = "managed-in-azure"
  }

  lifecycle {
    ignore_changes = [secret]
  }
}

