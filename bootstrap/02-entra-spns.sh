#!/usr/bin/env bash
# Create Entra (Azure AD) Service Principal Names (SPNs) for each environment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/variables.sh"

validate_prerequisites

echo "================================================"
echo "Creating Entra Service Principals"
echo "================================================"

TENANT_ID=$(az account show --query tenantId -o tsv)

for env in "${ENVIRONMENTS[@]}"; do
  echo ""
  echo "Environment: $env"
  echo "----------------------------------------"
  
  SPN_NAME=$(spn_name "$env")
  
  # Check if app registration already exists
  APP_ID=$(az ad app list --display-name "$SPN_NAME" --query "[0].appId" -o tsv 2>/dev/null || echo "")
  
  if [[ -n "$APP_ID" ]]; then
    echo "✓ App registration '$SPN_NAME' already exists (App ID: $APP_ID)"
  else
    echo "Creating app registration '$SPN_NAME'..."
    APP_ID=$(az ad app create \
      --display-name "$SPN_NAME" \
      --query appId -o tsv)
    echo "✓ App registration created (App ID: $APP_ID)"
  fi
  
  # Check if service principal exists
  SP_ID=$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv 2>/dev/null || echo "")
  
  if [[ -n "$SP_ID" ]]; then
    echo "✓ Service principal already exists"
  else
    echo "Creating service principal..."
    az ad sp create --id "$APP_ID" --output none
    echo "✓ Service principal created"
  fi
  
  # Assign Contributor role at subscription level
  SUBSCRIPTION_SCOPE="/subscriptions/$AZURE_SUBSCRIPTION_ID"
  
  if az role assignment list \
    --assignee "$APP_ID" \
    --scope "$SUBSCRIPTION_SCOPE" \
    --role "Contributor" \
    --query "[0].id" -o tsv &>/dev/null; then
    echo "✓ Contributor role already assigned"
  else
    echo "Assigning Contributor role at subscription level..."
    az role assignment create \
      --assignee "$APP_ID" \
      --role "Contributor" \
      --scope "$SUBSCRIPTION_SCOPE" \
      --output none
    echo "✓ Role assigned"
  fi
  
  echo ""
  echo "Service principal details for $env:"
  echo "  Name:            $SPN_NAME"
  echo "  Application ID:  $APP_ID"
  echo "  Tenant ID:       $TENANT_ID"
  echo "  Subscription ID: $AZURE_SUBSCRIPTION_ID"
done

echo ""
echo "================================================"
echo "✅ Service principals setup complete"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Run ./03-gh-oidc.sh to configure GitHub OIDC federation"
