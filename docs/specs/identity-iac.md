# Identity & Multi-IdP IaC Spec — E-CLAT

> **Status:** Infrastructure Specification  
> **Owner:** Daniels (Microservices Engineer)  
> **Date:** 2026-03-19  
> **Issue:** #95  
> **Related Decision:** Decision #2 (Multi-IdP + SCIM)  
> **Applies To:** `infra/layers/00-foundation`, `infra/modules/identity`, `apps/api/src/modules/auth`

---

## 1. Overview

This spec defines the identity infrastructure for E-CLAT, supporting cloud (Microsoft Entra/Azure AD) and on-prem deployments (Keycloak, Okta, LDAP). Multi-IdP strategy enables SaaS deployments (multi-tenant Entra app) and customer-deployed scenarios (single-tenant Entra app or self-hosted). SCIM provisioning automates user/group sync from HR systems.

### Key Principles
- **Multi-tenant (cloud):** Single Entra app serves all SaaS customers; tenant routing via OIDC claims
- **Single-tenant (on-prem):** Customer deploys their own Entra app or Keycloak
- **SCIM 2.0:** User/group sync from Okta, Workday, Active Directory
- **Just-in-time (JIT) provisioning:** First login auto-creates employee record
- **Role sync:** Group membership in IdP → RBAC roles in E-CLAT

---

## 2. Azure Resource Topology

### 2.1 Cloud: Multi-Tenant SaaS

```
┌─ Entra Tenant (Microsoft's)
│  │
│  ├─ App Registration: "E-CLAT SaaS"
│  │  ├─ Multi-tenant: Yes
│  │  ├─ Redirect URI: https://app.e-clat.io/auth/callback
│  │  ├─ Sign-out URL: https://app.e-clat.io/auth/logout
│  │  └─ Grant types: Authorization Code + PKCE
│  │
│  ├─ App Roles (RBAC)
│  │  ├─ "admin" → maps to E-CLAT ADMIN (5)
│  │  ├─ "compliance_officer" → COMPLIANCE_OFFICER (4)
│  │  ├─ "manager" → MANAGER (2)
│  │  ├─ "supervisor" → SUPERVISOR (1)
│  │  └─ "employee" → EMPLOYEE (0)
│  │
│  ├─ Required Permissions (scope)
│  │  ├─ User.Read (user profile)
│  │  ├─ GroupMember.Read.All (group membership for role sync)
│  │  ├─ Directory.Read.All (org structure)
│  │  └─ Application.ReadWrite.All (SCIM endpoint registration)
│  │
│  └─ Conditional Access Policies
│     ├─ Require MFA for admin roles
│     ├─ Block legacy auth
│     └─ Device compliance checks
│
├─ SCIM Service Principal
│  ├─ Service principal (not app registration)
│  ├─ Permission: "SCIM Synchronization" role
│  └─ Endpoint: https://api.e-clat.io/scim/v2/
│
└─ Key Vault
   ├─ Secret: entra-app-id
   ├─ Secret: entra-client-secret
   ├─ Secret: entra-tenant-id
   └─ Certificate: IdP signing certificates (refreshed annually)
```

### 2.2 Single-Tenant (Customer-Deployed)

```
┌─ Customer's Entra Tenant (or on-prem Keycloak)
│  │
│  ├─ App Registration: "E-CLAT On-Prem"
│  │  ├─ Single-tenant: Yes
│  │  ├─ Redirect URI: https://{customer-domain}/auth/callback
│  │  └─ Grant types: Authorization Code + PKCE
│  │
│  ├─ SCIM Provisioner (if HR system supports SCIM)
│  │  └─ Target: https://{customer-domain}/scim/v2/
│  │
│  └─ Service Principal (or Keycloak service account)
│     └─ Permissions: minimal (just SCIM provisioning)
│
└─ Customer's Key Vault (or on-prem secret store)
   ├─ Secret: IdP client credentials
   └─ Certificate: IdP signing certificate
```

### 2.3 On-Prem: Keycloak + LDAP

```
┌─ Keycloak Instance (Docker or K8s)
│  │
│  ├─ Realm: "e-clat-{customer}"
│  │  ├─ OpenID Connect server
│  │  ├─ LDAP user federation (Active Directory)
│  │  ├─ Roles (mapped to E-CLAT RBAC)
│  │  └─ SCIM 2.0 endpoint (Keycloak plugin)
│  │
│  ├─ LDAP Configuration
│  │  ├─ Connection: ldaps://ad.customer.com:636
│  │  ├─ Bind DN: "cn=svc-keycloak,ou=service-accounts,dc=customer,dc=com"
│  │  ├─ User DN: "ou=employees,dc=customer,dc=com"
│  │  ├─ Group DN: "ou=groups,dc=customer,dc=com"
│  │  └─ Sync interval: Hourly
│  │
│  └─ SCIM Provisioner
│     └─ Inbound: From LDAP
│        Outbound: To E-CLAT API
│
└─ PostgreSQL (Keycloak state)
   └─ Self-managed by customer
```

---

## 3. Terraform Module Structure

### 3.1 Layer 00-Foundation: `identity` module

**Path:** `infra/modules/identity/`

```
identity/
├── main.tf                    # Resource definitions
├── outputs.tf                 # IDs, endpoints, credentials (to Key Vault)
├── variables.tf               # Tunable parameters
├── entra-saas.tf             # Multi-tenant Entra app registration
├── entra-roles.tf            # App roles (admin, manager, etc.)
├── scim-provisioner.tf       # SCIM service principal
├── conditional-access.tf     # MFA, device compliance policies
├── keycloak-onprem.tf        # On-prem Keycloak (alternative)
└── variables/
    ├── tenants.tfvars         # Tenant-to-Entra-ID mappings
    └── rbac-mapping.tfvars    # Role hierarchy
```

### 3.2 Main.tf: Layer 00-Foundation Instantiation

```hcl
# infra/layers/00-foundation/main.tf (identity section)

module "identity" {
  source = "../../modules/identity"

  environment                    = var.environment
  location                       = var.location
  project_name                   = var.project_name

  # Entra Configuration
  entra_enabled                  = var.deployment_type == "saas" ? true : false
  entra_multi_tenant             = var.entra_multi_tenant  # true for SaaS
  entra_app_name                 = "${var.project_name}-${var.environment}"
  entra_redirect_uris            = var.entra_redirect_uris # https://app.e-clat.io/auth/callback
  entra_sign_out_uri             = var.entra_sign_out_uri  # https://app.e-clat.io/auth/logout

  # SCIM Provisioning
  scim_enabled                   = var.scim_enabled  # true
  scim_endpoint                  = "${var.api_base_url}/scim/v2/"
  scim_auth_type                 = "bearer"          # Bearer token or Basic auth

  # Conditional Access (prod only)
  conditional_access_enabled     = var.environment == "prod" ? true : false
  mfa_required_roles             = ["admin", "compliance_officer"]
  block_legacy_auth              = var.environment == "prod"
  device_compliance_required     = var.environment == "prod"

  # On-Prem Alternative
  keycloak_enabled               = var.deployment_type == "onprem" ? true : false
  keycloak_realm                 = var.keycloak_realm  # "e-clat-{customer}"
  keycloak_ldap_enabled          = var.keycloak_ldap_enabled
  keycloak_ldap_url              = var.keycloak_ldap_url  # ldaps://ad.customer.com:636

  # Key Vault
  key_vault_id                   = azurerm_key_vault.main.id
}
```

### 3.3 Entra App Registration (SaaS)

```hcl
# infra/modules/identity/entra-saas.tf

data "azuread_client_config" "current" {}

# App Registration: E-CLAT SaaS (multi-tenant)
resource "azuread_application" "saas" {
  count = var.entra_enabled ? 1 : 0

  display_name = var.entra_app_name
  owners       = [data.azuread_client_config.current.object_id]

  # Multi-tenant support
  sign_in_audience = "AzureADMultipleOrgs"

  # Redirect URIs
  single_page_application {
    redirect_uris = var.entra_redirect_uris
  }

  # Web API configuration
  web {
    homepage_url  = "https://${var.api_base_url}"
    redirect_uris = concat(var.entra_redirect_uris, [var.entra_sign_out_uri])

    implicit_grant {
      access_token_issuance_enabled = false
      id_token_issuance_enabled     = true
    }

    cors {
      allowed_origins = ["https://${var.app_base_url}"]
    }
  }

  # API: Expose scopes
  api {
    requested_access_token_version = 2

    oauth2_permission_scope {
      admin_consent_description  = "Full access to E-CLAT API"
      admin_consent_display_name = "Full Access"
      enabled                    = true
      id                         = "00000000-0000-0000-0000-000000000001"
      type                       = "User"
      user_consent_description   = "Access your E-CLAT data"
      user_consent_display_name  = "Access E-CLAT"
      value                      = "api://access"
    }
  }

  # Require group membership for role assignment
  required_resource_access {
    resource_app_id = "00000003-0000-0000-c000-000000000000" # Microsoft Graph API

    resource_access {
      id   = "e1fe6dd8-ba31-4d61-89e7-88639da4683d" # User.Read
      type = "Scope"
    }

    resource_access {
      id   = "5b567255-7703-4780-807c-7be8301ae99b" # GroupMember.Read.All
      type = "Scope"
    }

    resource_access {
      id   = "62a82d76-70ea-41e2-9197-370581155b63" # Directory.Read.All
      type = "Scope"
    }
  }

  tags = [
    "e-clat",
    var.environment,
    "multi-tenant"
  ]
}

# Service Principal for the app
resource "azuread_service_principal" "saas" {
  count = var.entra_enabled ? 1 : 0

  application_id = azuread_application.saas[0].application_id

  app_role_assignment_required = false  # Allow login without role assignment

  tags = [
    "e-clat",
    var.environment
  ]
}

# Generate client secret (rotate annually)
resource "azuread_application_password" "saas" {
  count = var.entra_enabled ? 1 : 0

  application_object_id = azuread_application.saas[0].object_id
  display_name          = "${var.entra_app_name}-secret-${formatdate("YYYY-MM", timestamp())}"
  end_date_relative     = "8760h"  # 1 year

  lifecycle {
    ignore_changes = [end_date_relative]  # Prevent auto-rotation
  }
}

# Store credentials in Key Vault
resource "azurerm_key_vault_secret" "entra_app_id" {
  count = var.entra_enabled ? 1 : 0

  name         = "entra-app-id"
  value        = azuread_application.saas[0].application_id
  key_vault_id = var.key_vault_id

  tags = {
    environment = var.environment
    component   = "identity"
  }
}

resource "azurerm_key_vault_secret" "entra_client_secret" {
  count = var.entra_enabled ? 1 : 0

  name         = "entra-client-secret"
  value        = azuread_application_password.saas[0].value
  key_vault_id = var.key_vault_id

  tags = {
    environment = var.environment
    component   = "identity"
  }
}

resource "azurerm_key_vault_secret" "entra_tenant_id" {
  count = var.entra_enabled ? 1 : 0

  name         = "entra-tenant-id"
  value        = data.azuread_client_config.current.tenant_id
  key_vault_id = var.key_vault_id

  tags = {
    environment = var.environment
    component   = "identity"
  }
}
```

### 3.4 App Roles (RBAC Mapping)

```hcl
# infra/modules/identity/entra-roles.tf

# Map E-CLAT roles to Entra app roles
resource "azuread_app_role" "admin" {
  count = var.entra_enabled ? 1 : 0

  application_object_id = azuread_application.saas[0].object_id
  role_id               = "00000000-0000-0000-0000-000000000001"
  allowed_member_types  = ["User"]
  description           = "Administrator role"
  display_name          = "admin"
  value                 = "admin"

  depends_on = [
    azuread_service_principal.saas
  ]
}

resource "azuread_app_role" "compliance_officer" {
  count = var.entra_enabled ? 1 : 0

  application_object_id = azuread_application.saas[0].object_id
  role_id               = "00000000-0000-0000-0000-000000000002"
  allowed_member_types  = ["User"]
  description           = "Compliance Officer role"
  display_name          = "compliance_officer"
  value                 = "compliance_officer"

  depends_on = [
    azuread_service_principal.saas
  ]
}

resource "azuread_app_role" "manager" {
  count = var.entra_enabled ? 1 : 0

  application_object_id = azuread_application.saas[0].object_id
  role_id               = "00000000-0000-0000-0000-000000000003"
  allowed_member_types  = ["User"]
  description           = "Manager role"
  display_name          = "manager"
  value                 = "manager"

  depends_on = [
    azuread_service_principal.saas
  ]
}

resource "azuread_app_role" "supervisor" {
  count = var.entra_enabled ? 1 : 0

  application_object_id = azuread_application.saas[0].object_id
  role_id               = "00000000-0000-0000-0000-000000000004"
  allowed_member_types  = ["User"]
  description           = "Supervisor role"
  display_name          = "supervisor"
  value                 = "supervisor"

  depends_on = [
    azuread_service_principal.saas
  ]
}

resource "azuread_app_role" "employee" {
  count = var.entra_enabled ? 1 : 0

  application_object_id = azuread_application.saas[0].object_id
  role_id               = "00000000-0000-0000-0000-000000000005"
  allowed_member_types  = ["User"]
  description           = "Employee role"
  display_name          = "employee"
  value                 = "employee"

  depends_on = [
    azuread_service_principal.saas
  ]
}
```

### 3.5 SCIM Provisioner Service Principal

```hcl
# infra/modules/identity/scim-provisioner.tf

# SCIM Service Principal (for inbound/outbound provisioning)
resource "azuread_service_principal" "scim" {
  count = var.scim_enabled ? 1 : 0

  application_id = "2e8f2e8e-0f0e-0e0e-0e0e-0e0e0e0e0e0e"  # Graph API app ID
  owners         = [data.azuread_client_config.current.object_id]

  tags = [
    "e-clat",
    "scim",
    var.environment
  ]
}

# SCIM credentials (bearer token)
resource "azuread_service_principal_password" "scim" {
  count = var.scim_enabled ? 1 : 0

  service_principal_id = azuread_service_principal.scim[0].object_id
  display_name         = "SCIM provisioning token"
  end_date_relative    = "8760h"  # 1 year
}

# Store SCIM token in Key Vault
resource "azurerm_key_vault_secret" "scim_token" {
  count = var.scim_enabled ? 1 : 0

  name         = "scim-bearer-token"
  value        = azuread_service_principal_password.scim[0].value
  key_vault_id = var.key_vault_id

  tags = {
    environment = var.environment
    component   = "identity"
  }
}
```

### 3.6 Conditional Access Policies

```hcl
# infra/modules/identity/conditional-access.tf

# Require MFA for admin and compliance roles
resource "azuread_conditional_access_policy" "mfa_required_admin" {
  count = var.conditional_access_enabled ? 1 : 0

  display_name = "Require MFA for Admin and Compliance Roles"
  state        = "enabled"

  conditions {
    applications {
      included_applications = [azuread_service_principal.saas[0].application_id]
    }

    users {
      included_groups = [
        # References to groups in Entra with admin/compliance roles
        # This is a placeholder; actual group IDs would come from Entra
      ]
    }

    # Exclude emergency access accounts
    users {
      excluded_groups = [
        # Breakglass group ID
      ]
    }
  }

  grant_controls {
    operator          = "OR"
    built_in_controls = ["mfa"]
  }
}

# Block legacy authentication
resource "azuread_conditional_access_policy" "block_legacy_auth" {
  count = var.block_legacy_auth ? 1 : 0

  display_name = "Block Legacy Authentication"
  state        = "enabled"

  conditions {
    applications {
      included_applications = ["All"]
    }

    client_app_types = [
      "exchangeActiveSync",
      "otherClients"
    ]

    # Apply to all users
    users {
      included_users = ["All"]
    }

    # Except service principals
    users {
      excluded_roles = [
        # Global reader, etc.
      ]
    }
  }

  grant_controls {
    operator          = "OR"
    built_in_controls = ["block"]
  }
}

# Require device compliance (prod only)
resource "azuread_conditional_access_policy" "device_compliance" {
  count = var.device_compliance_required ? 1 : 0

  display_name = "Require Device Compliance for Privileged Access"
  state        = "enabled"

  conditions {
    applications {
      included_applications = [azuread_service_principal.saas[0].application_id]
    }

    users {
      included_groups = [
        # Admin, compliance officer groups
      ]
    }
  }

  grant_controls {
    operator          = "AND"
    built_in_controls = ["compliantDevice"]
  }
}
```

### 3.7 On-Prem: Keycloak (Docker Compose)

```hcl
# infra/modules/identity/keycloak-onprem.tf

resource "docker_image" "keycloak" {
  count = var.keycloak_enabled ? 1 : 0

  name         = "keycloak/keycloak:latest"
  keep_locally = true
}

resource "docker_container" "keycloak" {
  count = var.keycloak_enabled ? 1 : 0

  image = docker_image.keycloak[0].image_id
  name  = "${var.project_name}-keycloak-${var.environment}"

  ports {
    internal = 8080
    external = var.keycloak_port
  }

  env = [
    "KEYCLOAK_ADMIN=${var.keycloak_admin_user}",
    "KEYCLOAK_ADMIN_PASSWORD=${var.keycloak_admin_password}",
    "KC_DB=postgres",
    "KC_DB_URL=jdbc:postgresql://${azurerm_postgresql_server.main.fqdn}/${var.keycloak_db_name}",
    "KC_DB_USERNAME=${var.keycloak_db_user}",
    "KC_DB_PASSWORD=${var.keycloak_db_password}",
    "KC_PROXY=edge",
    "KC_PROXY_ADDRESS_FORWARDING=true",
  ]

  networks_advanced {
    name = docker_network.backend.name
  }

  depends_on = [
    azurerm_postgresql_server.main
  ]
}

# Keycloak Realm Configuration (via Helm for K8s)
resource "helm_release" "keycloak" {
  count = var.keycloak_enabled && var.deployment_type == "kubernetes" ? 1 : 0

  name             = "keycloak"
  repository       = "https://codecentric.github.io/helm-charts"
  chart            = "keycloak"
  namespace        = "identity"
  create_namespace = true

  values = [
    yamlencode({
      replicas = 2
      database = {
        vendor = "postgresql"
        url    = "jdbc:postgresql://${azurerm_postgresql_server.main.fqdn}:5432/${var.keycloak_db_name}"
        username = var.keycloak_db_user
        password = var.keycloak_db_password
      }
      keycloakInitialAdminUser = var.keycloak_admin_user
      keycloakInitialAdminPassword = var.keycloak_admin_password
      realms = {
        "e-clat" = {
          displayName = "E-CLAT"
          enabled     = true
          # LDAP federation
          userStorageProviders = {
            "ldap" = {
              providerId = "ldap"
              priority   = 0
              config = {
                connectionUrl = var.keycloak_ldap_url
                bindDn        = var.keycloak_ldap_bind_dn
                bindCredential = var.keycloak_ldap_bind_password
                usersDn       = var.keycloak_ldap_users_dn
                groupsDn      = var.keycloak_ldap_groups_dn
                syncRegistrations = "true"
              }
            }
          }
          # SCIM 2.0 endpoint
          clientScopes = {
            "scim" = {
              name = "SCIM 2.0"
              protocol = "openid-connect"
            }
          }
        }
      }
    })
  ]
}
```

---

## 4. Cost Estimates

### 4.1 Cloud (Azure Entra)

| Component | Cost |
|-----------|------|
| Entra ID P1 (per tenant) | $6/user/month (billed for active users) |
| App Registration (Entra) | Included in tenant cost |
| Conditional Access Policies | Included in P1 |
| SCIM Provisioning | Included in P1 |
| **Total (100 users)** | **~$600/month** |

### 4.2 On-Prem (Self-Hosted Keycloak)

| Component | Annual |
|-----------|--------|
| Keycloak (open-source) | $0 |
| PostgreSQL (self-managed) | Infra cost only |
| LDAP connector (Keycloak plugin) | $0 |
| SCIM 2.0 provider (3rd-party) | $500–2,000/year |
| **Total** | **Infrastructure only** |

---

## 5. Security Configuration

### 5.1 Secret Rotation

```hcl
resource "null_resource" "rotate_entra_secret_annually" {
  triggers = {
    expiration_date = azuread_application_password.saas[0].end_date
  }

  provisioner "local-exec" {
    command = <<-EOT
      # Rotate on 1 Jan each year
      if date +%m-%d | grep -q "01-01"; then
        echo "Rotating Entra client secret..."
        az ad app credential reset --id ${azuread_application.saas[0].application_id}
      fi
    EOT
  }
}
```

### 5.2 B2B Invite Policy (SaaS)

```hcl
# Block B2B guests unless explicitly invited (prod)
resource "azuread_directory_role_assignment" "restrict_b2b" {
  count = var.environment == "prod" ? 1 : 0

  scope              = "/directory"
  role_definition_id = "65c64046-0204-4cf8-80f5-ef8d53ccaa63"  # Invitation Issuer role
  principal_object_id = data.azuread_client_config.current.object_id
}
```

### 5.3 LDAP Security (On-Prem)

```hcl
# Keycloak LDAP: require TLS
data "kubernetes_secret" "ldap_cert" {
  count = var.keycloak_ldap_enabled && var.environment == "prod" ? 1 : 0

  metadata {
    name      = "ldap-ca-cert"
    namespace = "identity"
  }
}

# Mount certificate in Keycloak pod
resource "kubernetes_volume_mount" "ldap_cert" {
  count = var.keycloak_ldap_enabled ? 1 : 0

  name       = "ldap-ca"
  mount_path = "/etc/ssl/certs/ldap-ca.pem"
  sub_path   = "ca.pem"

  depends_on = [
    data.kubernetes_secret.ldap_cert
  ]
}
```

---

## 6. Networking

### 6.1 Multi-Tenant Routing (Cloud)

```
┌─ Azure Front Door (global entry)
│  └─ Route: app.e-clat.io
│     └─ Detects tenant from OAuth2 `tenant_id` claim
│        ├─ Tenant 1 → Row-level data in shared DB
│        ├─ Tenant 2 → Row-level data in shared DB
│        └─ Tenant N → Dedicated DB (enterprise tier)
│
└─ API
   └─ /auth/callback
      └─ Extracts tenant_id from OIDC `tid` or custom claim
         └─ Sets tenant context in JWT
```

### 6.2 Single-Tenant Routing (On-Prem)

```
┌─ Customer's App Server
│  └─ auth.customer.com
│     └─ Keycloak realm: e-clat-{customer}
│        └─ LDAP federation
│
└─ E-CLAT API
   └─ api.customer.com/api
      └─ No tenant routing (single tenant hardcoded)
```

---

## 7. Deployment Automation

### 7.1 Entra App Setup (GitHub Actions)

```yaml
# .github/workflows/deploy-identity.yml
name: Deploy Identity Infrastructure

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment (dev, staging, prod)'
        required: true
        default: 'dev'

jobs:
  entra:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2

      - name: Create Entra App & Store Secrets
        run: |
          cd infra/layers/00-foundation
          terraform init
          terraform apply \
            -var-file="${{ github.event.inputs.environment }}.tfvars" \
            -target=module.identity \
            -auto-approve

      - name: Verify SCIM Endpoint
        run: |
          curl -H "Authorization: Bearer ${{ secrets.SCIM_TOKEN }}" \
            https://api.e-clat.io/scim/v2/Users

      - name: Log Event to Audit
        run: |
          echo "Entra app provisioned for ${{ github.event.inputs.environment }}"
```

### 7.2 Keycloak Rollout (Helm)

```bash
# On-prem K8s deployment
helm repo add keycloak https://codecentric.github.io/helm-charts
helm repo update
helm install keycloak keycloak/keycloak \
  -n identity \
  -f infra/modules/identity/keycloak-values.yaml
```

---

## 8. Implementation Checklist

### Phase 1: Entra App Setup (Week 1)
- [ ] Create Entra app registration (multi-tenant)
- [ ] Configure redirect URIs
- [ ] Add app roles (admin, manager, supervisor, employee)
- [ ] Generate client secret, store in Key Vault
- [ ] Grant Graph API permissions

### Phase 2: SCIM Provisioning (Week 2)
- [ ] Create SCIM service principal
- [ ] Generate SCIM token, store in Key Vault
- [ ] Implement SCIM 2.0 endpoint in API (`apps/api/src/modules/auth/scim.ts`)
- [ ] Test: Okta → E-CLAT user sync

### Phase 3: Conditional Access (Week 3)
- [ ] Create MFA policy for admin/compliance roles
- [ ] Block legacy authentication (prod)
- [ ] Device compliance policy (prod)

### Phase 4: On-Prem Option (Week 4–6)
- [ ] Deploy Keycloak (Docker or K8s)
- [ ] Configure LDAP federation
- [ ] Set up SCIM provider
- [ ] Test customer-deployed scenario

---

## 9. Tenant Routing Logic (API Implementation)

```typescript
// apps/api/src/modules/auth/tenant-context.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface TenantContext {
  tenantId: string;
  userId: string;
  roles: string[];
  idpType: 'entra' | 'keycloak' | 'okta'; // Detected from token issuer
}

export function extractTenantContext(req: Request): TenantContext {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Bearer token');
  }

  const token = authHeader.slice(7);
  const decoded = jwt.decode(token, { complete: true });

  const tenantId = decoded?.payload?.tid || decoded?.payload?.tenant_id;
  if (!tenantId) {
    throw new ForbiddenError('Token missing tenant context (tid/tenant_id claim)');
  }

  return {
    tenantId,
    userId: decoded?.payload?.sub || decoded?.payload?.oid,
    roles: decoded?.payload?.roles || decoded?.payload?.app_roles || [],
    idpType: decoded?.payload?.iss?.includes('keycloak') ? 'keycloak' : 'entra',
  };
}

// Middleware: inject tenant context into req
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    req.tenantContext = extractTenantContext(req);
    next();
  } catch (err) {
    next(err);
  }
}
```

---

## 10. JIT Provisioning (Just-in-Time)

```typescript
// apps/api/src/modules/auth/jit-provisioning.ts

export async function ensureEmployeeExists(
  tenantId: string,
  idpUser: { oid: string; displayName: string; mail: string; jobTitle?: string }
) {
  const employee = await prisma.employee.findUnique({
    where: { idp_user_id: idpUser.oid },
  });

  if (!employee) {
    // Auto-create on first login
    await prisma.employee.create({
      data: {
        tenant_id: tenantId,
        idp_user_id: idpUser.oid,
        first_name: idpUser.displayName.split(' ')[0],
        last_name: idpUser.displayName.split(' ')[1] || '',
        email: idpUser.mail,
        role: 'EMPLOYEE', // Default; SCIM will promote to supervisor/manager if in group
        created_at: new Date(),
      },
    });

    // Log audit event
    await logAuditEvent(tenantId, 'EMPLOYEE_JIT_PROVISIONED', {
      oid: idpUser.oid,
      email: idpUser.mail,
    });
  }
}
```

---

## 11. Related Documentation

- **Decision #2:** Multi-IdP + SCIM (`.squad/decisions.md`)
- **Service Architecture:** `docs/specs/service-architecture-spec.md`
- **RBAC API Spec:** `docs/specs/rbac-api-spec.md`
- **Setup Guide:** `docs/guides/identity-setup-guide.md` (TBD)

---

**Status:** Ready for Terraform implementation  
**Estimated Effort:** 4–6 weeks (cloud + on-prem parity)  
**Owner:** Daniels (Microservices Engineer), Identity team
