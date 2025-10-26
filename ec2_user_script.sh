#!/bin/bash

# Exit immediately if any command fails
set -e

# Update and install dependencies
dnf update -y
dnf install -y nodejs git

# Clone the repository
cd /home/ec2-user
git clone https://github.com/aksbuzz/brandkit.git app

# Move into the app directory
cd app

# Remove unnecessary folders
rm -rf infrastructure/ lambdas/ web/

# Move server files to the root of app
mv server/* .
rm -rf server/

# Install dependencies
npm install

# Create and configure .env file
cat <<EOL > .env
DB_HOST=brandkit-db.cz24q0wc8vgi.ap-south-1.rds.amazonaws.com
DB_USER=myadmin
DB_PASSWORD=password123
DB_NAME=brandkitdb
DB_DATABASE=brandkitdb
DB_PORT=5432
PORT=8080
AWS_REGION=ap-south-1
AWS_S3_BUCKET_NAME=brandkit-assets-61a19fdacbf7
EOL

echo ".env file created successfully."

# (Optional) Test database connection (requires PostgreSQL client)
# psql -h "brandkit-db.cz24q0wc8vgi.ap-south-1.rds.amazonaws.com" -p 5432 -U "myadmin" -d brandkitdb

# Build the project
npm run build

# Start the application with PM2
npm install -g pm2
pm2 start npm --name "brandkit-api" -- start
pm2 startup
pm2 save
pm2 list

echo "✅ Brandkit setup complete and running under PM2!"
