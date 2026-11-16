variable "workspace_name" {
  description = "Name of the Log Analytics Workspace"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the Azure Resource Group"
  type        = string
}

variable "location" {
  description = "Azure deployment region"
  type        = string
}

variable "sku" {
  description = "Log Analytics Workspace SKU"
  type        = string
  default     = "PerGB2018"
}

variable "retention_in_days" {
  description = "Data retention period in days"
  type        = number
  default     = 30
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

