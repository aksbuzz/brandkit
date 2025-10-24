# output "api_server_public_ip" {
#   description = "The public IP address of the EC2 API server."
#   value       = aws_instance.api_server.public_ip
# }

# output "ssh_command" {
#   description = "Command to SSH into the API server."
#   value       = "ssh -i ~/.ssh/id_rsa ec2-user@${aws_instance.api_server.public_ip}"
# }

output "s3_bucket_name" {
  value       = aws_s3_bucket.main.bucket
}

output "rds_endpoint" {
  value       = aws_db_instance.main.endpoint
}
