# --- IAM Role for EC2 Instance ---
resource "aws_iam_role" "ec2_role" {
  name = "${var.project_name}-ec2-role"
  assume_role_policy = jsonencode(
    {
      Version = "2012-10-17",
      Statement = [
        {
          Action    = "sts:AssumeRole",
          Effect    = "Allow",
          Principal = { Service = "ec2.amazonaws.com" }
        }
      ]
    }
  )
}

# The API only signs upload forms for new originals; it never reads objects (reads go through CloudFront).
resource "aws_iam_policy" "ec2_policy" {
  name = "${var.project_name}-ec2-policy"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action   = ["s3:PutObject"],
        Effect   = "Allow",
        Resource = "${aws_s3_bucket.main.arn}/originals/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ec2_policy_attach" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = aws_iam_policy.ec2_policy.arn
}

# Lets operators open a shell with SSM Session Manager instead of exposing SSH
resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2_role.name
}


# --- IAM Role for Lambda Worker ---
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role"
  assume_role_policy = jsonencode(
    {
      Version = "2012-10-17",
      Statement = [
        {
          Action    = "sts:AssumeRole",
          Effect    = "Allow",
          Principal = { Service = "lambda.amazonaws.com" }
        }
      ]
    }
  )
}

resource "aws_iam_policy" "lambda_policy" {
  name = "${var.project_name}-lambda-policy"
  policy = jsonencode(
    {
      Version = "2012-10-17",
      Statement = [
        {
          Sid      = "ReadOriginals",
          Action   = ["s3:GetObject"],
          Effect   = "Allow",
          Resource = "${aws_s3_bucket.main.arn}/originals/*"
        },
        {
          Sid      = "WriteVariants",
          Action   = ["s3:PutObject"],
          Effect   = "Allow",
          Resource = "${aws_s3_bucket.main.arn}/derived/*"
        },
        {
          # Used by the cleanup worker once it is deployed (see docs/adr/0012)
          Sid    = "DeleteObjects",
          Action = ["s3:DeleteObject"],
          Effect = "Allow",
          Resource = [
            "${aws_s3_bucket.main.arn}/originals/*",
            "${aws_s3_bucket.main.arn}/derived/*"
          ]
        },
        {
          Sid      = "ConsumeQueue",
          Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
          Effect   = "Allow",
          Resource = aws_sqs_queue.main_queue.arn
        }
      ]
    }
  )
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}

resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}
