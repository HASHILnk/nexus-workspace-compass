variable "acr_name" {
  description = "Azure Container Registry name"
  type        = string
}

variable "resource_group_name" {
  description = "Azure Resource Group name"
  type        = string
}

variable "location" {
  description = "Azure deployment region"
  type        = string
}

variable "sku" {
  description = "Azure Container Registry SKU"
  type        = string
  default     = "Basic"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "owner" {
  description = "Infrastructure owner"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

