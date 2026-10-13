terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "benchmark_frame_count" {
  type    = number
  default = 500
}

# S3 Bucket for Storing Ground-Truth Benchmark Telemetry
resource "aws_s3_bucket" "benchmark_results" {
  bucket_prefix = "avica-benchmark-telemetry-"
  force_destroy = true
}

# IAM Role for Instances to upload telemetry to S3
resource "aws_iam_role" "benchmark_runner_role" {
  name = "avica-benchmark-runner-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "s3_upload_policy" {
  name = "avica-benchmark-s3-upload"
  role = aws_iam_role.benchmark_runner_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = [
        "s3:PutObject",
        "s3:GetObject"
      ]
      Effect   = "Allow"
      Resource = "${aws_s3_bucket.benchmark_results.arn}/*"
    }]
  })
}

resource "aws_iam_instance_profile" "benchmark_profile" {
  name = "avica-benchmark-instance-profile"
  role = aws_iam_role.benchmark_runner_role.name
}

# 1. Target Environment A: x86 (c6i.xlarge — Intel Xeon 8375C Ice Lake)
data "aws_ami" "ubuntu_x86" {
  most_recent = true
  owners      = ["099720109477"] # Canonical
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_instance" "x86_c6i_runner" {
  ami                  = data.aws_ami.ubuntu_x86.id
  instance_type        = "c6i.xlarge"
  iam_instance_profile = aws_iam_instance_profile.benchmark_profile.name

  tags = {
    Name        = "avica-benchmark-x86-c6i"
    Environment = "Benchmarking"
    Arch        = "x86_64"
  }

  user_data = <<-EOF
              #!/bin/bash
              set -ex
              apt-get update && apt-get install -y curl git jq docker.io
              curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
              apt-get install -y nodejs
              git clone https://github.com/avica-vision/avica.git /opt/avica || cd /opt/avica
              cd /opt/avica
              npm ci && npm run build
              node scripts/run_graviton_benchmark.js --frames=${var.benchmark_frame_count} --env=x86_c6i --out=/tmp/x86_telemetry.json
              aws s3 cp /tmp/x86_telemetry.json s3://${aws_s3_bucket.benchmark_results.bucket}/x86_c6i_telemetry.json
              EOF
}

# 2. Target Environment B & C: AWS Graviton3 (c7g.xlarge — Neoverse-V1)
data "aws_ami" "ubuntu_arm64" {
  most_recent = true
  owners      = ["099720109477"] # Canonical
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-arm64-server-*"]
  }
}

resource "aws_instance" "graviton_c7g_runner" {
  ami                  = data.aws_ami.ubuntu_arm64.id
  instance_type        = "c7g.xlarge"
  iam_instance_profile = aws_iam_instance_profile.benchmark_profile.name

  tags = {
    Name        = "avica-benchmark-graviton-c7g"
    Environment = "Benchmarking"
    Arch        = "arm64"
  }

  user_data = <<-EOF
              #!/bin/bash
              set -ex
              apt-get update && apt-get install -y curl git jq libjemalloc2 numactl docker.io
              curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
              apt-get install -y nodejs
              git clone https://github.com/avica-vision/avica.git /opt/avica || cd /opt/avica
              cd /opt/avica
              npm ci && npm run build
              
              # Standard Graviton Execution
              node scripts/run_graviton_benchmark.js --frames=${var.benchmark_frame_count} --env=graviton_c7g --out=/tmp/graviton_telemetry.json
              aws s3 cp /tmp/graviton_telemetry.json s3://${aws_s3_bucket.benchmark_results.bucket}/graviton_c7g_telemetry.json

              # Graviton + COOL Execution (jemalloc + numactl thread pinning + SIMD flags)
              LD_PRELOAD=/usr/lib/aarch64-linux-gnu/libjemalloc.so.2 \
              MALLOC_CONF="narenas:4,background_thread:true" \
              NODE_OPTIONS="--experimental-wasm-simd --max-semi-space-size=128" \
              numactl --physcpubind=0,1,2,3 --localalloc \
              node scripts/run_graviton_benchmark.js --frames=${var.benchmark_frame_count} --env=graviton_cool_c7g --out=/tmp/graviton_cool_telemetry.json
              aws s3 cp /tmp/graviton_cool_telemetry.json s3://${aws_s3_bucket.benchmark_results.bucket}/graviton_cool_c7g_telemetry.json
              EOF
}

output "results_s3_bucket" {
  value = aws_s3_bucket.benchmark_results.bucket
}

output "x86_instance_id" {
  value = aws_instance.x86_c6i_runner.id
}

output "graviton_instance_id" {
  value = aws_instance.graviton_c7g_runner.id
}
