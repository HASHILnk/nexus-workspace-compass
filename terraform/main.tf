# Variables / Locals
locals {
  acr_name           = "nexusbijok2026"
  container_app_name = "nexus-app"
  environment_name   = "nexus-environment"
  log_analytics_name = "workspace-rgnexusdevBQOx"
}

# 1. Resource Group
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

# 2. Azure Container Registry
module "container_registry" {
  source = "./modules/container-registry"

  acr_name            = local.acr_name
  resource_group_name = module.resource_group.resource_group_name
  location            = module.resource_group.resource_group_location

  sku          = "Basic"
  environment  = var.environment
  owner        = var.owner
  project_name = var.project_name
}

moved {
  from = azurerm_container_registry.acr
  to   = module.container_registry.azurerm_container_registry.acr
}

# 3. Log Analytics Workspace
module "log_analytics" {
  source = "./modules/log-analytics"

  workspace_name      = local.log_analytics_name
  resource_group_name = module.resource_group.resource_group_name
  location            = module.resource_group.resource_group_location
  sku                 = "PerGB2018"
  retention_in_days   = 30

  environment  = var.environment
  owner        = var.owner
  project_name = var.project_name
}

moved {
  from = azurerm_log_analytics_workspace.logs
  to   = module.log_analytics.azurerm_log_analytics_workspace.logs
}

# 4. Container Apps Environment
module "container_app_environment" {
  source = "./modules/container-app-environment"

  environment_name           = local.environment_name
  resource_group_name        = module.resource_group.resource_group_name
  location                   = module.resource_group.resource_group_location
  log_analytics_workspace_id = module.log_analytics.id

  environment  = var.environment
  owner        = var.owner
  project_name = var.project_name
}

moved {
  from = azurerm_container_app_environment.env
  to   = module.container_app_environment.azurerm_container_app_environment.env
}

# 5. Container App
module "container_app" {
  source = "./modules/container-app"

  container_app_name           = local.container_app_name
  container_app_environment_id = module.container_app_environment.id
  resource_group_name          = module.resource_group.resource_group_name
  registry_server              = module.container_registry.login_server
  image                        = "${module.container_registry.login_server}/nexus:BUILD_TAG"

  environment  = var.environment
  owner        = var.owner
  project_name = var.project_name
}

moved {
  from = azurerm_container_app.app
  to   = module.container_app.azurerm_container_app.app
}
