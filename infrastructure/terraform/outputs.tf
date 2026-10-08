output "api_base_url" {
  description = "Use as VITE_API_BASE_URL for the web app"
  value       = "https://${aws_cloudfront_distribution.s3_distribution.domain_name}/api/v1"
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.s3_distribution.domain_name
}

output "api_server_public_ip" {
  description = "Elastic IP of the API host (the API itself is only reachable through CloudFront)"
  value       = aws_eip.api.public_ip
}

output "api_server_instance_id" {
  description = "Open a shell with: aws ssm start-session --target <this id>"
  value       = aws_instance.api_server.id
}

output "s3_bucket_name" {
  value = aws_s3_bucket.main.bucket
}

output "rds_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "alerts_topic_arn" {
  value = aws_sns_topic.alerts.arn
}
