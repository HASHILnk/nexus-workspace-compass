variable "container_app_name" {
  description = "Name of the Container App"
  type        = string
}

variable "container_app_environment_id" {
  description = "ID of the Container App Environment"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the Azure Resource Group"
  type        = string
}

variable "revision_mode" {
  description = "Container App revision mode"
  type        = string
  default     = "Multiple"
}

variable "workload_profile_name" {
  description = "Workload profile name"
  type        = string
  default     = "Consumption"
}

variable "container_name" {
  description = "Name of the container"
  type        = string
  default     = "nexus-app"
}

variable "image" {
  description = "Container image to deploy"
  type        = string
}

variable "cpu" {
  description = "Number of CPU cores allocated to the container"
  type        = number
  default     = 0.5
}

variable "memory" {
  description = "Amount of memory allocated to the container"
  type        = string
  default     = "1Gi"
}

variable "min_replicas" {
  description = "Minimum number of replicas"
  type        = number
  default     = 0
}

variable "max_replicas" {
  description = "Maximum number of replicas"
  type        = number
  default     = 10
}

variable "ingress_external_enabled" {
  description = "Whether the ingress is exposed externally"
  type        = bool
  default     = true
}

variable "target_port" {
  description = "Target port for ingress"
  type        = number
  default     = 3000
}

variable "ingress_transport" {
  description = "Ingress transport protocol"
  type        = string
  default     = "auto"
}

variable "registry_server" {
  description = "Container registry login server"
  type        = string
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

