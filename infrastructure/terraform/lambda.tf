# Build the bundle first: `npm run build` in lambdas/image-processor (creates dist/handler.js,
# which already contains pg-promise and the RDS CA bundle; only sharp comes from the layer).
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambdas/image-processor/dist"
  output_path = "${path.module}/dist/worker.zip"
  excludes    = ["handler.js.map"]
}

# Created explicitly so the logs expire instead of accumulating forever
resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/${var.project_name}-worker"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "worker" {
  function_name = "${var.project_name}-worker"
  handler       = "handler.handler"
  runtime       = "nodejs22.x"
  role          = aws_iam_role.lambda_role.arn
  layers = [
    # sharp native binaries. Build the layer once, see the README.
    var.lambda_layer_arn
  ]

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  timeout     = 300
  memory_size = 2048

  vpc_config {
    subnet_ids         = [aws_subnet.private_a.id, aws_subnet.private_b.id]
    security_group_ids = [aws_security_group.lambda_sg.id]
  }

  environment {
    variables = {
      BUCKET             = aws_s3_bucket.main.bucket
      DB_HOST            = aws_db_instance.main.address
      DB_PORT            = aws_db_instance.main.port
      DB_USER            = var.db_username
      DB_PASSWORD        = var.db_password
      DB_NAME            = var.db_name
      DB_SSL             = "true"
      MAX_ORIGINAL_BYTES = var.max_upload_bytes
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.worker,
    aws_iam_role_policy_attachment.lambda_policy_attach,
    aws_iam_role_policy_attachment.lambda_vpc_access,
    aws_vpc_endpoint.s3,
  ]
}

resource "aws_lambda_event_source_mapping" "worker_sqs_mapping" {
  event_source_arn = aws_sqs_queue.main_queue.arn
  function_name    = aws_lambda_function.worker.arn

  # One image per invocation: a slow or failing image cannot time out or retry its neighbours
  batch_size = 1

  # Caps parallel invocations (and therefore database connections: the worker opens one each)
  scaling_config {
    maximum_concurrency = var.worker_max_concurrency
  }

  # Per-record failure reporting: only the failed message returns to the queue
  function_response_types = ["ReportBatchItemFailures"]
}
