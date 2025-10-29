# resource "aws_key_pair" "deployer" {
#   key_name   = "brandkit-key"
#   public_key = file("~/.ssh/id_rsa.pub")
# }

resource "aws_instance" "api_server" {
  ami                    = "ami-06fa3f12191aa3337" # Amazon Linux 2023 for ap-south-1
  instance_type          = "t3.small"
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.ec2_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  key_name               = var.ec2_key_name

  # User data script to bootstrap the server
  user_data = <<-EOF
              #!/bin/bash
              # Update and install dependencies
              dnf update -y
              dnf install -y nodejs git
              
              # Clone the repository
              cd /home/ec2-user
              git clone https://github.com/aksbuzz/brandkit.git app

              # Move into the app directory
              cd app/server

              # Install dependencies
              npm install
              
              # Create and configure .env file
              touch .env
              echo "DB_HOST=${aws_db_instance.main.address}" > .env
              echo "DB_USER=${var.db_username}" >> .env
              echo "DB_PASSWORD=${var.db_password}" >> .env
              echo "DB_NAME=${var.db_name}" >> .env
              echo "DB_DATABASE=${var.db_name}" >> .env
              echo "DB_PORT=${aws_db_instance.main.port}" >> .env
              echo "PORT=8080" >> .env
              echo "AWS_REGION=${var.aws_region}" >> .env
              echo "AWS_S3_BUCKET_NAME=${aws_s3_bucket.main.bucket}" >> .env
              echo "AWS_CLOUDFRONT_DOMAIN_NAME=${aws_cloudfront_distribution.main.domain_name}" >> .env
              
              # Build the project
              npm run build
              
              # Start the application with PM2
              npm install -g pm2
              pm2 start npm --name "brandkit-api" -- start
              pm2 startup
              pm2 save
              EOF

  tags = {
    Name = "${var.project_name}-api-server"
  }
}
