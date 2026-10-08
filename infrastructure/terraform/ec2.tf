data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# Allocated before the instance so CloudFront can use its DNS name as the API origin without a
# dependency cycle, and so the address survives stop/start.
resource "aws_eip" "api" {
  domain = "vpc"
  tags = {
    Name = "${var.project_name}-api-eip"
  }
}

resource "aws_instance" "api_server" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = "t3.small"
  ebs_optimized          = true
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.ec2_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  key_name               = var.ec2_key_name

  # IMDSv2 only: a request-forgery bug in the app cannot read the instance role's credentials
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 16
    encrypted   = true
  }

  user_data = templatefile("${path.module}/templates/user_data.sh.tftpl", {
    repo_url          = var.app_repo_url
    git_ref           = var.app_git_ref
    aws_region        = var.aws_region
    bucket            = aws_s3_bucket.main.bucket
    cloudfront_domain = aws_cloudfront_distribution.s3_distribution.domain_name
    allowed_origins   = join(",", var.allowed_api_origins)
    max_upload_bytes  = var.max_upload_bytes
    api_key           = var.api_key
    db_host           = aws_db_instance.main.address
    db_port           = aws_db_instance.main.port
    db_user           = var.db_username
    db_password       = var.db_password
    db_name           = var.db_name
  })

  depends_on = [aws_internet_gateway.gw]

  lifecycle {
    # A newer AMI must not replace a running server; roll the instance deliberately instead
    ignore_changes = [ami]
  }

  tags = {
    Name = "${var.project_name}-api-server"
  }
}

resource "aws_eip_association" "api" {
  instance_id   = aws_instance.api_server.id
  allocation_id = aws_eip.api.id
}
