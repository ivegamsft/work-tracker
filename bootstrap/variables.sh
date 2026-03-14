#!/usr/bin/env bash
# Shared variables for bootstrap scripts

set -euo pipefail

# Project configuration
export PROJECT_NAME="eclat"
export LOCATION="eastus2"
export ENVIRONMENTS=("dev" "staging" "prod")

# Azure subscription (will be detected or set)
export AZURE_SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-$(az account show --query id -o tsv 2>/dev/null || echo '')}"

# GitHub repository (auto-detect if gh CLI is available)
if command -v gh &> /dev/null; then
  export GH_REPO="${GH_REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo '')}"
else
  export GH_REPO="${GH_REPO:-}"
fi

# Resource naming conventions
storage_account_name() {
  local env=$1
  # Storage account names: lowercase, no hyphens, globally unique
  echo "${PROJECT_NAME}tfstate${env}"
}

resource_group_name() {
  local env=$1
  echo "${PROJECT_NAME}-${env}-tfstate-rg"
}

container_name() {
  echo "tfstate"
}

spn_name() {
  local env=$1
  echo "${PROJECT_NAME}-${env}-deploy"
}

# Validation
validate_prerequisites() {
  if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI (az) is required but not installed"
    exit 1
  fi

  if [[ -z "$AZURE_SUBSCRIPTION_ID" ]]; then
    echo "❌ Could not detect Azure subscription. Please run 'az login' or set AZURE_SUBSCRIPTION_ID"
    exit 1
  fi

  echo "✅ Prerequisites validated"
  echo "   Project: $PROJECT_NAME"
  echo "   Location: $LOCATION"
  echo "   Subscription: $AZURE_SUBSCRIPTION_ID"
}
