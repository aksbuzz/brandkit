# CloudFront's origin-facing IP ranges, maintained by AWS
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# The VPC's default security group allows all traffic between its members; strip every rule so
# nothing can end up using it by accident.
resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.main.id
}

# --- Security Group for the EC2 API Server ---
resource "aws_security_group" "ec2_sg" {
  name        = "${var.project_name}-ec2-sg"
  description = "API server: reachable only through CloudFront"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "API from CloudFront only"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront.id]
  }

  dynamic "ingress" {
    for_each = var.ssh_allowed_cidr == null ? [] : [var.ssh_allowed_cidr]
    content {
      description = "SSH from trusted CIDR only"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    description = "Outbound to RDS, S3, package registries and GitHub"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# --- Security Group for the RDS Database ---
# No egress rules: the database only answers connections that clients open.
resource "aws_security_group" "rds_sg" {
  name        = "${var.project_name}-rds-sg"
  description = "Database: reachable only from the API server and the worker"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2_sg.id]
  }

  ingress {
    description     = "PostgreSQL from Lambda"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda_sg.id]
  }
}

# --- Security Group for the Lambda Worker ---
resource "aws_security_group" "lambda_sg" {
  name        = "${var.project_name}-lambda-sg"
  description = "Image worker: outbound only"
  vpc_id      = aws_vpc.main.id

  egress {
    description = "Outbound to RDS and to S3 through the gateway endpoint"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
