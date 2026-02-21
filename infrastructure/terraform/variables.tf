variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "project_name" {
  type    = string
  default = "brandkit"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "db_name" {
  type    = string
  default = "brandkitdb"
}

variable "db_username" {
  type = string
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "lambda_layer_arn" {
  type = string
}

variable "ec2_key_name" {
  type = string
}

variable "api_key" {
  type        = string
  sensitive   = true
  description = "Secret key required in X-Api-Key header for all API requests"
}

# Restrict SSH access to a known CIDR (e.g. your office/VPN IP).
# Never leave this as 0.0.0.0/0 in production.
variable "ssh_allowed_cidr" {
  type        = string
  description = "CIDR block allowed to SSH into the EC2 instance"
}

# Comma-separated list of allowed CORS origins for S3 direct uploads.
# Add your production frontend URL here (e.g. "https://app.example.com").
variable "allowed_upload_origins" {
  type        = list(string)
  description = "Origins allowed to PUT objects directly to S3"
  default     = ["http://localhost", "http://localhost:5173", "http://localhost:3000"]
}

# Set to false in production to retain a final DB snapshot on destroy.
variable "skip_final_snapshot" {
  type        = bool
  description = "Skip the final RDS snapshot when the DB is destroyed"
  default     = false
}
