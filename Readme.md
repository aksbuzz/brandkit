# BrandKit

#### Digital Asset Management System
A system for uploading, processing, and delivering images at scale. 

This application lets users upload images, automatically creates different sizes of those images, and serves them fast to users anywhere in the world.
 
![Arch](./Arch.png)

## Main Parts

### API Server (EC2)
A Node.js/Express application running on an EC2 instance. It handles all synchronous API requests, manages metadata, and orchestrates the upload and deletion processes.

### Database (RDS PostgreSQL)
The central source of truth for all asset metadata, user-defined presets, and variant information. It uses relational features like transactions and cascading deletes for data integrity.

### Storage (Amazon S3)
Private storage for all images. Has two folders:
- `originals/` - Original uploaded images
- `derived/` - Processed images in different sizes

### Processing Worker (Lambda + SQS)
When a new image is uploaded, this worker automatically:
- Downloads the original image
- Creates different sizes using sharp library
- Saves all versions back to storage
- Updates database with new information

### Content Delivery (CloudFront)
A CloudFront CDN sits in front of the S3 bucket, providing fast, low-latency, and cached delivery of images to users worldwide. It accesses the private S3 bucket.

### Network Security (VPC)
All core compute and database resources (EC2, RDS, Lambdas) are located within a Virtual Private Cloud (VPC) for network isolation and security.

## System Flows

### Asset Upload & Processing

1. User selects an image in the web app
2. App asks API server for upload permission
3. The API server creates a pending record in the RDS database and generates a secure, one-time pre-signed URL for uploading directly to a specific path in the S3 bucket `(originals/)`.
4. The client's browser uploads the file's binary data directly to the S3 pre-signed URL.
5. Upon successful upload, S3 automatically sends an ObjectCreated event notification to an SQS queue.
6.  The SQS message triggers the Worker Lambda. The Lambda downloads the original image, reads the required presets from RDS, generates all image variants (e.g., thumbnail, medium, large), and uploads them to the derived/ path in S3.
8.  Finally, the Worker Lambda updates the asset's status to `processed`

### Asset Delivery

1. User opens a page that needs images
2. App asks API server for image URLs
3. API server gives back CloudFront URLs (like `https://cdn.example.com/derived/thumb/image.jpg`)
4. Browser loads images from CloudFront
5. CloudFront serves from cache if available, or gets from S3 if not


## Technology Stack

- **Frontend**: React
- **Backend**: Node.js + Express
- **Database**: PostgreSQL (AWS RDS)
- **Storage**: AWS S3
- **Processing**: AWS Lambda + Sharp.js
- **Queue**: AWS SQS
- **CDN**: AWS CloudFront
- **Network**: AWS VPC
- **Region**: ap-south-1 (Mumbai)

## Setup Requirements

- AWS Account with VPC configured
- RDS PostgreSQL database
- S3 bucket with event notifications
- SQS queue
- Lambda function with Sharp.js layer
- CloudFront distribution with Origin Access Control
- EC2 instance or container for API server

## Development Setup Guide

### Prerequisites

Before you begin, you will need the following installed on your machine:

*   **AWS CLI**: Configured with credentials that have sufficient permissions to create the resources in the Terraform files. ([Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html))
*   **Terraform**: Version 1.0 or newer. ([Installation Guide](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli))
*   **Node.js**: 20 LTS.
*   **An SSH Key Pair**: You need an active SSH key pair in your AWS account in the `ap-south-1` region. This will be used to access the EC2 instance. ([Guide to create a key pair](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/create-key-pairs.html))
*   **A Lambda Layer for `sharp`**: The `sharp` library requires native binaries. You must create a Lambda Layer containing these binaries for the `nodejs22.x` runtime on an `x86_64` architecture.
    1.  Go to the **[sharp-aws-lambda-layer releases page](https://github.com/cbschuld/sharp-aws-lambda-layer/releases)**.
    2.  Download the latest ZIP file for `nodejs22` and `x86_64` (e.g., `sharp-layer-v0.33.3-node22-x64.zip`).
    3.  In the AWS Console, navigate to **Lambda -> Layers -> Create layer**.
    4.  Give it a name (e.g., `sharp-v0-33-3-node22-x64`), upload the ZIP file, select the `nodejs22.x` compatible runtime, and set the architecture to `x86_64`.
    5.  Once created, copy the full **Layer Version ARN**. You will need this for the Terraform deployment.

### 1. Backend Infrastructure (Terraform)

The Terraform scripts in the root directory provision all the necessary AWS resources.

**Setup Steps:**

1.  **Navigate to the root directory** of the project.

2.  **Create a configuration file** for your secrets and environment-specific variables. Create a file named `terraform.tfvars`:
    ```hcl
    # terraform.tfvars

    # Database credentials (choose a strong password)
    db_username = "damadmin"
    db_password = "YourSuperSecretPassword123!"

    # --- AWS Prerequisites ---
    # The name of the EC2 Key Pair you created in the AWS console
    ec2_key_name = "your-ec2-key-pair-name"

    # The full ARN of the sharp Lambda Layer you created
    lambda_layer_arn = "arn:aws:lambda:ap-south-1:123456789012:layer:sharp-v0-33-3-node18-x64:1"
    ```

3.  **Initialize Terraform:**
    ```bash
    terraform init
    ```

4.  **Plan and Apply the infrastructure:**
    ```bash
    terraform plan -var-file="terraform.tfvars"
    terraform apply -var-file="terraform.tfvars"
    ```
    Review the plan and type `yes` to deploy. This will take several minutes as it creates the VPC, RDS instance, EC2 server, and other resources.

5.  **Note the Outputs:** After the apply is complete, Terraform will print outputs. The `api_server_public_ip` is the IP address of your API server. The `rds_endpoint` is the address of your database.

### 2. Database Schema Migration

Once the RDS instance is running, you need to apply the initial database schema.

1.  **Connect to the Database**: SSH into the EC2 instance and use `psql` from there.
    ```bash
    # Once inside the EC2 instance, install postgresql client and connect
    sudo dnf install postgresql17 -y
    psql -h <rds_endpoint> -p 5432 -U <username> -d <dbname>
    ```
2.  **Run the Schema SQL**: Copy the contents of the SQL schema (provided in the `server/schema.sql`) and execute it in your SQL client. This will create the `presets`, `assets`, and `variants` tables.

### 3. Frontend

1.  **Navigate to the `frontend/` directory.**
2.  **Set up environment variables.** Create a `.env.local` file. The frontend needs to know the URL of the API server.
    ```
    # .env.local in frontend/
    VITE_API_BASE_URL=http://<api_server_public_ip>:8080/api/v1
    ```

3.  **Install dependencies and run:**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
    The Vite application will be available at `http://localhost:5173`.
