resource "random_id" "bucket_id" {
  byte_length = 6
}

resource "aws_s3_bucket" "main" {
  bucket = "${var.project_name}-assets-${random_id.bucket_id.hex}"
}

# The bucket is only ever read through CloudFront (OAC) and written through presigned uploads and the worker.
resource "aws_s3_bucket_public_access_block" "main" {
  bucket                  = aws_s3_bucket.main.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "main" {
  bucket = aws_s3_bucket.main.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  bucket = aws_s3_bucket.main.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Abandoned multipart uploads are invisible and billed until they are aborted
resource "aws_s3_bucket_lifecycle_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_sqs_queue" "main_dlq" {
  name                    = "${var.project_name}-main-dlq"
  sqs_managed_sse_enabled = true

  # Keep failed messages long enough to be investigated (the default is 4 days)
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "main_queue" {
  name                    = "${var.project_name}-main-queue"
  sqs_managed_sse_enabled = true

  # Must be >= 6x the Lambda timeout (300s) per AWS recommendation
  visibility_timeout_seconds = 1800

  redrive_policy = jsonencode(
    {
      deadLetterTargetArn = aws_sqs_queue.main_dlq.arn
      maxReceiveCount     = 3
    }
  )
}

resource "aws_s3_bucket_policy" "allow_cloudfront_access" {
  bucket = aws_s3_bucket.main.id
  policy = jsonencode(
    {
      Version = "2012-10-17",
      Statement = [
        {
          Effect    = "Allow"
          Principal = { Service = "cloudfront.amazonaws.com" },
          Action    = "s3:GetObject",
          Resource  = "${aws_s3_bucket.main.arn}/*"
          Condition = {
            StringEquals = {
              "AWS:SourceArn" = aws_cloudfront_distribution.s3_distribution.arn
            }
          }
        }
      ]
    }
  )

  # Changing the policy and the public access block at the same time can fail with OperationAborted
  depends_on = [aws_s3_bucket_public_access_block.main]
}

# Browsers upload with a presigned POST form (the API signs a size limit into it)
resource "aws_s3_bucket_cors_configuration" "brandkit_cors" {
  bucket = aws_s3_bucket.main.id

  cors_rule {
    allowed_origins = var.allowed_upload_origins
    allowed_methods = ["POST"]
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
