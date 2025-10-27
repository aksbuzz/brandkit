resource "aws_s3_bucket" "main" {
  bucket = "${var.project_name}-assets-${random_id.bucket_id.hex}"
}

resource "random_id" "bucket_id" {
  byte_length = 6
}

resource "aws_sqs_queue" "main_dlq" {
  name = "${var.project_name}-main-dlq"
}

resource "aws_sqs_queue" "main_queue" {
  name                       = "${var.project_name}-main-queue"
  visibility_timeout_seconds = 300

  redrive_policy = jsonencode(
    {
      deadLetterTargetArn = aws_sqs_queue.main_dlq.arn
      maxReceiveCount     = 3
    }
  )
}

resource "aws_s3_bucket_policy" "allow_cloudfront_access" {
  bucket = aws_s3_bucket.main.id
  policy = jsondecode(
    {
      Version = "2012-10-17",
      Statement = [
        {
          Effect = "Allow"
          Principal = { Service = "cloudfront.amazonaws.com" },
          Action = "s3:GetObject",
          Resource = "${aws_s3_bucket.main.arn}/*"
          Condition = {
            StringEquals = {
              "AWS:SourceArn" = aws_cloudfront_distribution.s3_distribution.arn
            }
          }
        }
      ]
    }
  )
}

resource "aws_s3_bucket_cors_configuration" "brandkit_cors" {
  bucket = aws_s3_bucket.main.id

  cors_rule {
    allowed_origins = ["http://localhost", "http://localhost:5173", "http://localhost:3000"]
    allowed_methods = ["PUT"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = aws_s3_bucket.main.id

  queue {
    queue_arn     = aws_sqs_queue.main_queue.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "originals/"
  }
  depends_on = [aws_sqs_queue_policy.s3_to_sqs]
}

resource "aws_sqs_queue_policy" "s3_to_sqs" {
  queue_url = aws_sqs_queue.main_queue.id
  policy = jsonencode(
    {
      Version = "2012-10-17",
      Statement = [
        {
          Effect    = "Allow",
          Principal = { Service = "s3.amazonaws.com" },
          Action    = "sqs:SendMessage",
          Resource  = aws_sqs_queue.main_queue.arn,
          Condition = { ArnEquals = { "aws:SourceArn" = aws_s3_bucket.main.arn } }
        }
      ]
    }
  )
}
