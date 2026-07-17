variable "cloud_id" { type = string }
variable "folder_id" { type = string }
variable "yc_token" {
  type      = string
  sensitive = true
}
variable "environment" {
  type    = string
  default = "prod"
}
