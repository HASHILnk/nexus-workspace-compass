variable "resource_group_name" {
  description = "Name of the NEXUS Azure Resource Group"
  type        = string
  default     = "rg-nexus-dev"
}

variable "location" {
  description = "Azure deployment region"
  type        = string
  default     = "centralindia"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "Development"
}

variable "project_name" {
  description = "Application project name"
  type        = string
  default     = "NEXUS"
}

variable "owner" {
  description = "Infrastructure owner"
  type        = string
  default     = "DevOpsLearning"
}

