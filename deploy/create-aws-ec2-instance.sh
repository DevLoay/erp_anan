#!/usr/bin/env bash
set -Eeuo pipefail

REGION="${REGION:-eu-north-1}"
APP_NAME="${APP_NAME:-mohamed-shawki-erp}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.micro}"
REPO_URL="${REPO_URL:-https://github.com/DevLoay/erp_anan.git}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@logistics-erp.com}"
ADMIN_NAME="${ADMIN_NAME:-System Admin}"
APP_PORT="${APP_PORT:-3040}"
VOLUME_SIZE_GB="${VOLUME_SIZE_GB:-20}"
TERMINATE_INSTANCE_ID="${TERMINATE_INSTANCE_ID:-}"

log() {
  printf '[%s] %s\n' "$APP_NAME" "$*"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

random_hex() {
  openssl rand -hex "${1:-16}"
}

tag_spec() {
  local resource_type="$1"
  printf 'ResourceType=%s,Tags=[{Key=Name,Value=%s},{Key=Project,Value=%s},{Key=ManagedBy,Value=codex-cloudshell}]' \
    "$resource_type" "$APP_NAME" "$APP_NAME"
}

main() {
  require_cmd aws
  require_cmd openssl
  require_cmd curl

  log "Checking AWS account."
  local account
  account="$(aws sts get-caller-identity --query Account --output text)"
  log "Account: $account"

  if [ -n "$TERMINATE_INSTANCE_ID" ]; then
    log "Terminating failed instance: $TERMINATE_INSTANCE_ID"
    aws ec2 terminate-instances \
      --region "$REGION" \
      --instance-ids "$TERMINATE_INSTANCE_ID" \
      --output text >/dev/null
  fi

  log "Resolving default VPC and subnet in $REGION."
  local vpc_id subnet_id
  vpc_id="$(aws ec2 describe-vpcs \
    --region "$REGION" \
    --filters Name=is-default,Values=true \
    --query 'Vpcs[0].VpcId' \
    --output text)"

  if [ -z "$vpc_id" ] || [ "$vpc_id" = "None" ]; then
    echo "No default VPC found in $REGION. Create a default VPC first or set VPC_ID/SUBNET_ID manually." >&2
    exit 1
  fi

  subnet_id="$(aws ec2 describe-subnets \
    --region "$REGION" \
    --filters Name=vpc-id,Values="$vpc_id" Name=default-for-az,Values=true \
    --query 'Subnets[0].SubnetId' \
    --output text)"

  if [ -z "$subnet_id" ] || [ "$subnet_id" = "None" ]; then
    subnet_id="$(aws ec2 describe-subnets \
      --region "$REGION" \
      --filters Name=vpc-id,Values="$vpc_id" \
      --query 'Subnets[0].SubnetId' \
      --output text)"
  fi

  log "VPC: $vpc_id"
  log "Subnet: $subnet_id"

  log "Resolving Ubuntu 24.04 LTS AMI."
  local ami_id
  ami_id="$(aws ssm get-parameter \
    --region "$REGION" \
    --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id \
    --query 'Parameter.Value' \
    --output text)"
  log "AMI: $ami_id"

  log "Creating or reusing security group."
  local sg_id
  sg_id="$(aws ec2 describe-security-groups \
    --region "$REGION" \
    --filters Name=group-name,Values="$APP_NAME-sg" Name=vpc-id,Values="$vpc_id" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null || true)"

  if [ -z "$sg_id" ] || [ "$sg_id" = "None" ]; then
    sg_id="$(aws ec2 create-security-group \
      --region "$REGION" \
      --group-name "$APP_NAME-sg" \
      --description "$APP_NAME web access" \
      --vpc-id "$vpc_id" \
      --tag-specifications "$(tag_spec security-group)" \
      --query 'GroupId' \
      --output text)"
  fi
  log "Security group: $sg_id"

  aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$sg_id" \
    --ip-permissions "IpProtocol=tcp,FromPort=$APP_PORT,ToPort=$APP_PORT,IpRanges=[{CidrIp=0.0.0.0/0,Description='ERP web app'}]" \
    >/dev/null 2>&1 || true

  log "Preparing EC2 user data."
  local admin_password user_data_file
  admin_password="Admin@$(random_hex 8)"
  user_data_file="$(mktemp)"
  cat > "$user_data_file" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail
export REPO_URL="$REPO_URL"
export ADMIN_EMAIL="$ADMIN_EMAIL"
export ADMIN_NAME="$ADMIN_NAME"
export ADMIN_PASSWORD="$admin_password"
curl -fsSL https://raw.githubusercontent.com/DevLoay/erp_anan/main/deploy/aws-ec2-user-data.sh -o /root/aws-ec2-user-data.sh
bash /root/aws-ec2-user-data.sh
EOF

  log "Launching EC2 instance."
  local instance_id
  instance_id="$(aws ec2 run-instances \
    --region "$REGION" \
    --image-id "$ami_id" \
    --instance-type "$INSTANCE_TYPE" \
    --subnet-id "$subnet_id" \
    --security-group-ids "$sg_id" \
    --associate-public-ip-address \
    --credit-specification CpuCredits=standard \
    --block-device-mappings "DeviceName=/dev/sda1,Ebs={VolumeSize=$VOLUME_SIZE_GB,VolumeType=gp3,DeleteOnTermination=true}" \
    --tag-specifications "$(tag_spec instance)" "$(tag_spec volume)" \
    --user-data "file://$user_data_file" \
    --query 'Instances[0].InstanceId' \
    --output text)"

  rm -f "$user_data_file"

  log "Instance: $instance_id"
  log "Waiting until instance is running."
  aws ec2 wait instance-running --region "$REGION" --instance-ids "$instance_id"

  local public_ip
  public_ip="$(aws ec2 describe-instances \
    --region "$REGION" \
    --instance-ids "$instance_id" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)"

  local result_file="$HOME/${APP_NAME}-deployment.txt"
  cat > "$result_file" <<EOF
Instance ID: $instance_id
Region: $REGION
Public URL: http://$public_ip:$APP_PORT
Health URL: http://$public_ip:$APP_PORT/api/health
Admin email: $ADMIN_EMAIL
Temporary admin password: $admin_password
Security group: $sg_id

The app can take 10-20 minutes on a small free-tier instance while Docker and Next.js build.
Check user-data logs later with:
aws ec2 get-console-output --region $REGION --instance-id $instance_id --latest --output text | tail -200
EOF

  log "Deployment info saved to $result_file"
  cat "$result_file"
}

main "$@"
