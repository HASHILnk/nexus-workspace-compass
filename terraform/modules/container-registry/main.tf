resource "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = var.sku
  admin_enabled       = false

  tags = {
    Environment = var.environment
    Owner       = var.owner
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

