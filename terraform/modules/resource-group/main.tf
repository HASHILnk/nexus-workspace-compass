resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    Environment = var.environment
    Owner       = var.owner
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }

  lifecycle {
    prevent_destroy = true
  }
}

