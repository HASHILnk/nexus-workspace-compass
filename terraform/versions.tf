terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100"
    }
  }

  backend "azurerm" {
    resource_group_name  = "rg-nexus-dev"
    storage_account_name = "nexustate64720"
    container_name       = "tfstate"
    key                  = "nexus.terraform.tfstate"
    use_azuread_auth     = true
  }
}
