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
  key_name               = "brandkit-key"

  # User data script to bootstrap the server
  user_data = <<-EOF
              #!/bin/bash
              # Update and install dependencies
              dnf update -y
              dnf install -y nodejs git
              
              # Install PM2 to run the Node.js app as a service
              npm install pm2 -g
              EOF

  tags = {
    Name = "${var.project_name}-api-server"
  }
}

  # user_data = <<-EOF
  #             #!/bin/bash
  #             # Update and install dependencies
  #             dnf update -y
  #             dnf install -y nodejs git
              
  #             # Install PM2 to run the Node.js app as a service
  #             npm install pm2 -g
              
  #             # --- Your Application Deployment ---
  #             # This is a placeholder. In a real scenario, you'd use a CI/CD tool.
  #             # For now, it clones a repo and starts the app.
  #             cd /home/ec2-user
  #             git clone https://github.com/your-username/your-api-repo.git app
  #             cd app
  #             npm install
              
  #             # Create a .env file with database credentials
  #             # WARNING: This is not secure for production. Use Secrets Manager or Parameter Store.
  #             echo "DB_HOST=${aws_db_instance.main.address}" >> .env
  #             echo "DB_USER=${var.db_username}" >> .env
  #             echo "DB_PASSWORD=${var.db_password}" >> .env
  #             echo "DB_NAME=${var.db_name}" >> .env
  #             echo "PORT=8080" >> .env
              
  #             # Start the application with PM2
  #             pm2 start server.js --name "dam-api"
              
  #             # Ensure PM2 restarts on server reboot
  #             pm2 startup
  #             pm2 save
  #             chown ec2-user:ec2-user /home/ec2-user/.pm2/rpc.sock /home/ec2-user/.pm2/pub.sock
  #             EOF