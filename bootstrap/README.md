# Bootstrap Scripts

One-time Azure infrastructure setup for the E-CLAT project. These scripts create the foundational resources needed before Terraform can manage the rest of the infrastructure.

## Prerequisites

- **Azure CLI** (`az`) — [Install guide](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
- **GitHub CLI** (`gh`) — Optional, for automatic secret creation. [Install guide](https://cli.github.com/)
- **Azure subscription** — You must have Contributor or Owner access
- **Bash shell** — Use WSL, Git Bash, or macOS/Linux terminal

## What Gets Created

1. **Storage Account for Terraform State** (`01-tf-state-storage.sh`)
   - Resource group per environment: `eclat-{env}-tfstate-rg`
   - Storage account per environment: `eclatstate{env}` (dev/staging/prod)
   - Blob container: `tfstate`
   - Versioning enabled for state file safety

2. **Entra Service Principals** (`02-entra-spns.sh`)
   - App registration per environment: `eclat-{env}-deploy`
   - Service principal with Contributor role at subscription level
   - Used for GitHub Actions OIDC authentication

3. **GitHub OIDC Federation** (`03-gh-oidc.sh`)
   - Federated identity credentials for passwordless auth
   - Main branch subject: `repo:{owner}/{repo}:ref:refs/heads/main`
   - Environment subject: `repo:{owner}/{repo}:environment:{env}`
   - GitHub secrets automatically set (if `gh` CLI is available)

## Order of Operations

Run scripts in numerical order:

```bash
# 1. Authenticate to Azure
az login
az account set --subscription <your-subscription-id>

# 2. Create Terraform state storage
./bootstrap/01-tf-state-storage.sh

# 3. Create service principals
./bootstrap/02-entra-spns.sh

# 4. Set up GitHub OIDC
export GH_REPO="owner/repo"  # Or let gh CLI auto-detect
./bootstrap/03-gh-oidc.sh
```

## Configuration

All scripts source `variables.sh` for shared configuration:

- **Project name:** `eclat`
- **Region:** `eastus2`
- **Environments:** `dev`, `staging`, `prod`

To customize, edit `variables.sh` before running the scripts.

## After Bootstrap

1. **Create Terraform backend configs** (if they don't exist):

   ```bash
   # infra/environments/dev.tfbackend
   resource_group_name  = "eclat-dev-tfstate-rg"
   storage_account_name = "eclatstatedev"
   container_name       = "tfstate"
   key                  = "terraform.tfstate"
   ```

   Repeat for `staging.tfbackend` and `prod.tfbackend`.

2. **Initialize Terraform:**

   ```bash
   cd infra
   terraform init -backend-config=environments/dev.tfbackend
   terraform plan -var-file=environments/dev.tfvars
   ```

3. **Create GitHub Actions workflow** to use OIDC authentication:

   ```yaml
   jobs:
     deploy:
       environment: dev
       permissions:
         id-token: write
         contents: read
       steps:
         - uses: azure/login@v1
           with:
             client-id: ${{ secrets.AZURE_CLIENT_ID_DEV }}
             tenant-id: ${{ secrets.AZURE_TENANT_ID_DEV }}
             subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID_DEV }}
   ```

## Idempotency

All scripts use check-before-create patterns. Safe to re-run if interrupted or if you need to add new environments later.

## Cleanup

To destroy bootstrap resources (⚠️ this will delete Terraform state):

```bash
# Delete storage accounts and resource groups
for env in dev staging prod; do
  az group delete --name "eclat-${env}-tfstate-rg" --yes --no-wait
done

# Delete service principals
for env in dev staging prod; do
  az ad app delete --id $(az ad app list --display-name "eclat-${env}-deploy" --query "[0].appId" -o tsv)
done
```

## Troubleshooting

**"Could not detect Azure subscription"**
- Run `az login` and ensure you're logged in
- Run `az account set --subscription <id>` to select the correct subscription

**"GitHub repository not detected"**
- Install `gh` CLI and run `gh auth login`
- Or manually set `export GH_REPO="owner/repo"`

**"Insufficient privileges"**
- You need Contributor or Owner role on the Azure subscription
- You need permission to create app registrations in Entra ID

**Storage account name conflicts**
- Storage account names are globally unique
- Edit `variables.sh` to change the `storage_account_name()` function if needed
