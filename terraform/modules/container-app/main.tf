resource "azurerm_container_app" "app" {
  name                         = var.container_app_name
  container_app_environment_id = var.container_app_environment_id
  resource_group_name          = var.resource_group_name
  revision_mode                = var.revision_mode
  workload_profile_name        = var.workload_profile_name

  identity {
    type = "SystemAssigned"
  }

  template {
    container {
      name   = var.container_name
      image  = var.image
      cpu    = var.cpu
      memory = var.memory

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

    min_replicas = var.min_replicas
    max_replicas = var.max_replicas
  }

  ingress {
    external_enabled = var.ingress_external_enabled
    target_port      = var.target_port
    transport        = var.ingress_transport

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  registry {
    server   = var.registry_server
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

  tags = {
    Environment = var.environment
    Owner       = var.owner
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }

  lifecycle {
    ignore_changes = [secret]
  }
}

