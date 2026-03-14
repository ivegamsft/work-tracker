#!/usr/bin/env bash
# Create Azure Storage Account and container for Terraform remote state backend

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/variables.sh"

validate_prerequisites

echo "================================================"
echo "Creating Terraform State Storage"
echo "================================================"

for env in "${ENVIRONMENTS[@]}"; do
  echo ""
  echo "Environment: $env"
  echo "----------------------------------------"
  
  RG_NAME=$(resource_group_name "$env")
  STORAGE_NAME=$(storage_account_name "$env")
  CONTAINER_NAME=$(container_name)
  
  # Create resource group
  if az group show --name "$RG_NAME" &>/dev/null; then
    echo "✓ Resource group '$RG_NAME' already exists"
  else
    echo "Creating resource group '$RG_NAME'..."
    az group create \
      --name "$RG_NAME" \
      --location "$LOCATION" \
      --output none
    echo "✓ Resource group created"
  fi
  
  # Create storage account
  if az storage account show --name "$STORAGE_NAME" --resource-group "$RG_NAME" &>/dev/null; then
    echo "✓ Storage account '$STORAGE_NAME' already exists"
  else
    echo "Creating storage account '$STORAGE_NAME'..."
    az storage account create \
      --name "$STORAGE_NAME" \
      --resource-group "$RG_NAME" \
      --location "$LOCATION" \
      --sku Standard_LRS \
      --kind StorageV2 \
      --min-tls-version TLS1_2 \
      --allow-blob-public-access false \
      --output none
    echo "✓ Storage account created"
  fi
  
  # Enable versioning for state file safety
  az storage account blob-service-properties update \
    --account-name "$STORAGE_NAME" \
    --resource-group "$RG_NAME" \
    --enable-versioning true \
    --output none
  
  # Create blob container
  if az storage container show \
    --name "$CONTAINER_NAME" \
    --account-name "$STORAGE_NAME" \
    --auth-mode login &>/dev/null; then
    echo "✓ Container '$CONTAINER_NAME' already exists"
  else
    echo "Creating container '$CONTAINER_NAME'..."
    az storage container create \
      --name "$CONTAINER_NAME" \
      --account-name "$STORAGE_NAME" \
      --auth-mode login \
      --output none
    echo "✓ Container created"
  fi
  
  echo ""
  echo "Backend configuration for $env:"
  echo "  resource_group_name  = \"$RG_NAME\""
  echo "  storage_account_name = \"$STORAGE_NAME\""
  echo "  container_name       = \"$CONTAINER_NAME\""
  echo "  key                  = \"terraform.tfstate\""
done

echo ""
echo "================================================"
echo "✅ Terraform state storage setup complete"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Update infra/environments/{dev,staging,prod}.tfbackend with the values above"
echo "  2. Run ./02-entra-spns.sh to create service principals"
