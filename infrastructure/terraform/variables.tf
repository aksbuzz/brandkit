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

# --- Database ---

variable "db_name" {
  type    = string
  default = "brandkitdb"
}

variable "db_username" {
  type = string
}

# The password is written to a dotenv file on the API host, so characters that dotenv or a shell
# would treat specially ($ # quotes backslash space backtick) are not allowed. RDS itself rejects / @ " and space.
variable "db_password" {
  type      = string
  sensitive = true

  validation {
    condition     = length(var.db_password) >= 12 && can(regex("^[A-Za-z0-9!%^&*()_+=.,:;?~-]+$", var.db_password))
    error_message = "db_password must be at least 12 characters and use only letters, digits and these symbols: ! % ^ & * ( ) _ + = . , : ; ? ~ -"
  }
}

variable "db_backup_retention_days" {
  type        = number
  description = "Days of automated RDS backups to keep (0 disables them)"
  default     = 7
}

# Set to true only for throwaway environments. When false, a final snapshot is taken on destroy
# and deletion protection is on, so tearing the stack down takes two applies.
variable "skip_final_snapshot" {
  type        = bool
  description = "Skip the final RDS snapshot (and deletion protection) so the database can be destroyed immediately"
  default     = false
}

# --- Worker ---

variable "lambda_layer_arn" {
  type        = string
  description = "ARN of a Lambda layer that provides the sharp library (nodejs22.x, x86_64)"
}

variable "worker_max_concurrency" {
  type        = number
  description = "Maximum concurrent worker invocations (2-1000); keeps database connections bounded"
  default     = 5

  validation {
    condition     = var.worker_max_concurrency >= 2 && var.worker_max_concurrency <= 1000
    error_message = "worker_max_concurrency must be between 2 and 1000."
  }
}

variable "log_retention_days" {
  type        = number
  description = "Retention for the worker's CloudWatch log group"
  default     = 30
}

# --- API server ---

variable "api_key" {
  type        = string
  sensitive   = true
  description = "Secret key required in the X-Api-Key header for all API requests"

  validation {
    condition     = length(var.api_key) >= 24 && can(regex("^[A-Za-z0-9_.~-]+$", var.api_key))
    error_message = "api_key must be at least 24 characters of letters, digits, and the symbols _ . ~ -"
  }
}

variable "app_repo_url" {
  type        = string
  description = "Git repository the API server is built from at first boot"
  default     = "https://github.com/aksbuzz/brandkit.git"
}

variable "app_git_ref" {
  type        = string
  description = "Branch, tag or commit SHA to deploy. Pin a tag or SHA for reproducible boots."
  default     = "main"
}

# Optional: with an SSH key and CIDR the instance accepts SSH. Leave both null and use SSM Session Manager.
variable "ec2_key_name" {
  type        = string
  description = "EC2 key pair for SSH access (optional)"
  default     = null
}

variable "ssh_allowed_cidr" {
  type        = string
  description = "CIDR block allowed to SSH to the API host, e.g. 203.0.113.7/32 (optional; null disables SSH)"
  default     = null
}

variable "allowed_api_origins" {
  type        = list(string)
  description = "Browser origins allowed to call the API (CORS). Add the URL where the web app is hosted."
  default     = ["http://localhost:5173", "http://localhost:3000"]
}

# --- Uploads and delivery ---

variable "allowed_upload_origins" {
  type        = list(string)
  description = "Origins allowed to POST objects directly to S3 (the web app's origin)"
  default     = ["http://localhost", "http://localhost:5173", "http://localhost:3000"]
}

variable "max_upload_bytes" {
  type        = number
  description = "Largest accepted upload. Enforced by the presigned POST policy, the API and the worker."
  default     = 10485760
}

variable "cloudfront_price_class" {
  type        = string
  description = "CloudFront price class. PriceClass_200 includes India and most of the world except South America and Australia."
  default     = "PriceClass_200"
}

# --- Monitoring ---

variable "alarm_email" {
  type        = string
  description = "Email address subscribed to the alerts topic (leave empty to create the topic without a subscriber)"
  default     = ""
}
