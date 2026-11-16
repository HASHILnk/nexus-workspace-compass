output "acr_name" {
  description = "Azure Container Registry name"
  value       = azurerm_container_registry.acr.name
}

output "login_server" {
  description = "Azure Container Registry login server"
  value       = azurerm_container_registry.acr.login_server
}

output "id" {
  description = "Azure Container Registry resource ID"
  value       = azurerm_container_registry.acr.id
}

