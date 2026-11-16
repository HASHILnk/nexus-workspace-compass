output "id" {
  description = "Container App ID"
  value       = azurerm_container_app.app.id
}

output "name" {
  description = "Container App name"
  value       = azurerm_container_app.app.name
}

output "fqdn" {
  description = "The FQDN of the deployed Container App"
  value       = azurerm_container_app.app.ingress[0].fqdn
}

