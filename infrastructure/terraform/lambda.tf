data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambdas/image-processor/dist"
  output_path = "${path.module}/dist/worker.zip"
}

resource "aws_lambda_function" "worker" {
  function_name = "${var.project_name}-worker"
  handler       = "handler.handler"
  runtime       = "nodejs22.x"
  role          = aws_iam_role.lambda_role.arn
  layers = [
    # Upload zip file in console - https://github.com/cbschuld/sharp-aws-lambda-layer/releases
    "arn:aws:lambda:ap-south-1:623102672468:layer:Sharp:1"
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
      BUCKET      = aws_s3_bucket.main.bucket
      DB_HOST     = aws_db_instance.main.address
      DB_PORT     = aws_db_instance.main.port
      DB_USER     = var.db_username
      DB_PASSWORD = var.db_password
      DB_NAME     = var.db_name
      DB_SSL      = true
    }
  }
}

resource "aws_lambda_event_source_mapping" "worker_sqs_mapping" {
  event_source_arn = aws_sqs_queue.main_queue.arn
  function_name    = aws_lambda_function.worker.arn
  batch_size       = 5
}
