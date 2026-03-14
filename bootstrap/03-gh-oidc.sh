#!/usr/bin/env bash
# Set up GitHub OIDC federation with Azure (federated identity credentials)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/variables.sh"

validate_prerequisites

if [[ -z "$GH_REPO" ]]; then
  echo "❌ GitHub repository not detected. Please set GH_REPO environment variable (format: owner/repo)"
  echo "   Example: export GH_REPO=myorg/work-tracker"
  exit 1
fi

if ! command -v gh &> /dev/null; then
  echo "⚠️  GitHub CLI (gh) not found. GitHub secrets will not be set automatically."
  echo "   You'll need to manually add secrets to your repository."
  SET_SECRETS=false
else
  SET_SECRETS=true
fi

echo "================================================"
echo "Setting up GitHub OIDC Federation"
echo "================================================"
echo "Repository: $GH_REPO"
echo ""

TENANT_ID=$(az account show --query tenantId -o tsv)

for env in "${ENVIRONMENTS[@]}"; do
  echo ""
  echo "Environment: $env"
  echo "----------------------------------------"
  
  SPN_NAME=$(spn_name "$env")
  
  # Get app registration
  APP_ID=$(az ad app list --display-name "$SPN_NAME" --query "[0].appId" -o tsv 2>/dev/null || echo "")
  
  if [[ -z "$APP_ID" ]]; then
    echo "❌ App registration '$SPN_NAME' not found. Run ./02-entra-spns.sh first."
    continue
  fi
  
  APP_OBJECT_ID=$(az ad app show --id "$APP_ID" --query id -o tsv)
  
  # Create federated credential for main branch deployments
  MAIN_CRED_NAME="${PROJECT_NAME}-${env}-main"
  MAIN_SUBJECT="repo:${GH_REPO}:ref:refs/heads/main"
  
  # Check if credential exists
  EXISTING_CRED=$(az ad app federated-credential list \
    --id "$APP_OBJECT_ID" \
    --query "[?name=='$MAIN_CRED_NAME'].name" -o tsv 2>/dev/null || echo "")
  
  if [[ -n "$EXISTING_CRED" ]]; then
    echo "✓ Federated credential '$MAIN_CRED_NAME' already exists"
  else
    echo "Creating federated credential for main branch..."
    az ad app federated-credential create \
      --id "$APP_OBJECT_ID" \
      --parameters '{
        "name": "'"$MAIN_CRED_NAME"'",
        "issuer": "https://token.actions.githubusercontent.com",
        "subject": "'"$MAIN_SUBJECT"'",
        "description": "GitHub Actions OIDC for '"$env"' environment (main branch)",
        "audiences": ["api://AzureADTokenExchange"]
      }' \
      --output none
    echo "✓ Federated credential created"
  fi
  
  # Create federated credential for environment-specific deployments
  ENV_CRED_NAME="${PROJECT_NAME}-${env}-environment"
  ENV_SUBJECT="repo:${GH_REPO}:environment:${env}"
  
  EXISTING_ENV_CRED=$(az ad app federated-credential list \
    --id "$APP_OBJECT_ID" \
    --query "[?name=='$ENV_CRED_NAME'].name" -o tsv 2>/dev/null || echo "")
  
  if [[ -n "$EXISTING_ENV_CRED" ]]; then
    echo "✓ Federated credential '$ENV_CRED_NAME' already exists"
  else
    echo "Creating federated credential for $env environment..."
    az ad app federated-credential create \
      --id "$APP_OBJECT_ID" \
      --parameters '{
        "name": "'"$ENV_CRED_NAME"'",
        "issuer": "https://token.actions.githubusercontent.com",
        "subject": "'"$ENV_SUBJECT"'",
        "description": "GitHub Actions OIDC for '"$env"' environment",
        "audiences": ["api://AzureADTokenExchange"]
      }' \
      --output none
    echo "✓ Federated credential created"
  fi
  
  # Set GitHub secrets (if gh CLI is available)
  if [[ "$SET_SECRETS" == true ]]; then
    echo "Setting GitHub secrets for $env environment..."
    
    gh secret set "AZURE_CLIENT_ID_${env^^}" \
      --body "$APP_ID" \
      --repo "$GH_REPO" \
      --env "$env" 2>/dev/null || true
    
    gh secret set "AZURE_TENANT_ID_${env^^}" \
      --body "$TENANT_ID" \
      --repo "$GH_REPO" \
      --env "$env" 2>/dev/null || true
    
    gh secret set "AZURE_SUBSCRIPTION_ID_${env^^}" \
      --body "$AZURE_SUBSCRIPTION_ID" \
      --repo "$GH_REPO" \
      --env "$env" 2>/dev/null || true
    
    echo "✓ GitHub secrets set for $env environment"
  fi
  
  echo ""
  echo "OIDC configuration for $env:"
  echo "  Client ID:       $APP_ID"
  echo "  Tenant ID:       $TENANT_ID"
  echo "  Subscription ID: $AZURE_SUBSCRIPTION_ID"
  echo "  Main subject:    $MAIN_SUBJECT"
  echo "  Env subject:     $ENV_SUBJECT"
done

echo ""
echo "================================================"
echo "✅ GitHub OIDC federation setup complete"
echo "================================================"

if [[ "$SET_SECRETS" == false ]]; then
  echo ""
  echo "⚠️  Manual action required:"
  echo "   Add the following secrets to your GitHub repository environments:"
  echo ""
  for env in "${ENVIRONMENTS[@]}"; do
    SPN_NAME=$(spn_name "$env")
    APP_ID=$(az ad app list --display-name "$SPN_NAME" --query "[0].appId" -o tsv 2>/dev/null || echo "")
    echo "   Environment: $env"
    echo "     AZURE_CLIENT_ID_${env^^}:       $APP_ID"
    echo "     AZURE_TENANT_ID_${env^^}:       $TENANT_ID"
    echo "     AZURE_SUBSCRIPTION_ID_${env^^}: $AZURE_SUBSCRIPTION_ID"
    echo ""
  done
fi

echo ""
echo "Sample GitHub Actions workflow snippet:"
echo ""
cat << 'EOF'
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: dev
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID_DEV }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID_DEV }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID_DEV }}
      - name: Deploy with Terraform
        run: |
          cd infra
          terraform init -backend-config=environments/dev.tfbackend
          terraform apply -var-file=environments/dev.tfvars
EOF
