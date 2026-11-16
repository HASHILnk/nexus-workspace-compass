resource "azurerm_container_app_environment" "env" {
  name                       = var.environment_name
  location                   = var.location
  resource_group_name        = var.resource_group_name
  log_analytics_workspace_id = var.log_analytics_workspace_id

  tags = {
    Environment = var.environment
    Owner       = var.owner
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }

  # Azure API does not return log_analytics_workspace_id on read/import.
  lifecycle {
    ignore_changes = [log_analytics_workspace_id]
  }
}

