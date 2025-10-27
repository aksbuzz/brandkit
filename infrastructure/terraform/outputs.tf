output "api_server_public_ip" {
  value = aws_instance.api_server.public_ip
}

output "s3_bucket_name" {
  value = aws_s3_bucket.main.bucket
}

output "rds_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.s3_distribution.domain_name
}
