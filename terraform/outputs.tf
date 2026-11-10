output "resource_group_name" {
  description = "NEXUS Azure Resource Group"
  value       = module.resource_group.resource_group_name
}

output "acr_login_server" {
  description = "Azure Container Registry login server"
  value       = azurerm_container_registry.acr.login_server
}

output "container_app_name" {
  description = "NEXUS Azure Container App"
  value       = azurerm_container_app.app.name
}

output "container_app_environment_name" {
  description = "NEXUS Container Apps Environment"
  value       = azurerm_container_app_environment.env.name
}

output "container_app_fqdn" {
  description = "The FQDN of the deployed Container App"
  value       = azurerm_container_app.app.ingress[0].fqdn
}

