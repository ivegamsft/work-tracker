# Smoke Deploy Checks

## Overview

Targeted smoke deploy checks verify that each subsystem is operational after deployment. These are lightweight health checks designed to provide fast feedback on deployment failures.

## Architecture

### Subsystems Tested

The smoke checks are organized by the 10 API subsystems:

| Subsystem | Module Path | Service Grouping | Tests |
|-----------|-------------|------------------|-------|
| Auth | `modules/auth` | Identity Platform | Login, token validation |
| Employees | `modules/employees` | Workforce Core | List employees, CRUD operations |
| Templates | `modules/templates` | Compliance Service | Templates, assignments, fulfillments |
| Hours | `modules/hours` | Records Service | Hour records, conflicts |
| Documents | `modules/documents` | Records Service | Documents, review queue |
| Qualifications | `modules/qualifications` | Compliance Service | Qualifications management |
| Medical | `modules/medical` | Compliance Service | Medical clearances |
| Standards | `modules/standards` | Reference Data | Compliance standards |
| Notifications | `modules/notifications` | Notifications Service | Notification management |
| Labels | `modules/labels` | Reference Data | Label taxonomy |

### Test Characteristics

- **Lightweight**: Health-check style, not full integration tests
- **Fast**: Complete in <1 minute total (parallel execution)
- **Targeted**: Each subsystem tested independently
- **Environment-aware**: Configurable for dev, staging, prod

## Running Smoke Tests

### Locally

```bash
# Start the API server
docker compose up -d

# Run all smoke tests
npm run test:smoke

# Run specific subsystem
npm run test:smoke -- tests/smoke/auth.smoke.test.ts
```

### Against Different Environments

```bash
# Test against dev environment
API_BASE_URL=https://api-dev.e-clat.azure.com npm run test:smoke

# Test with custom credentials
API_BASE_URL=https://api-staging.e-clat.azure.com \
SMOKE_ADMIN_EMAIL=admin@staging.com \
SMOKE_ADMIN_PASSWORD=StagingPass123! \
npm run test:smoke
```

### In CI/CD

Smoke tests run automatically after deployment via GitHub Actions:

```yaml
# Manual trigger
gh workflow run smoke-deploy.yml \
  -f environment=dev \
  -f api_url=https://api-dev.e-clat.azure.com
```

The deploy workflow automatically calls smoke checks after API deployment.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `http://localhost:3000` | API base URL to test |
| `SMOKE_ADMIN_EMAIL` | `admin@example.com` | Admin user email |
| `SMOKE_ADMIN_PASSWORD` | `Password123!` | Admin user password |

### GitHub Secrets

For production environments, set these secrets in GitHub:

- `SMOKE_ADMIN_EMAIL` - Admin email for smoke tests
- `SMOKE_ADMIN_PASSWORD` - Admin password for smoke tests

## Workflow Integration

### Deploy Workflow

The deploy workflow (`deploy.yml`) runs smoke checks after API deployment:

```
foundation → data → compute → deploy-api → smoke-checks
```

If smoke checks fail, the deployment is marked as failed.

### Smoke Check Workflow

The smoke check workflow (`smoke-deploy.yml`) runs subsystem tests in parallel:

```
smoke-auth
smoke-employees
smoke-templates
smoke-hours
smoke-documents
smoke-qualifications
smoke-medical
smoke-standards
smoke-notifications
smoke-labels
  ↓
smoke-summary
```

Each job is independent and can fail without blocking others. The summary job aggregates results.

## Adding New Smoke Tests

### 1. Create Test File

Create `tests/smoke/{subsystem}.smoke.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { loginAsAdmin, authenticatedGet, expectPaginatedResponse } from './helpers';

describe('MySubsystem Smoke', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
  });

  it('GET /api/mysubsystem returns 200', async () => {
    const res = await authenticatedGet('/api/mysubsystem', adminToken);
    await expectPaginatedResponse(res);
  });
});
```

### 2. Add Workflow Job

Add a job to `.github/workflows/smoke-deploy.yml`:

```yaml
smoke-mysubsystem:
  name: Smoke - MySubsystem
  runs-on: ubuntu-latest
  environment: ${{ inputs.environment }}
  steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-node@v6
      with:
        node-version: 20
        cache: npm
    - run: npm ci
    - name: Run mysubsystem smoke tests
      env:
        API_BASE_URL: ${{ env.API_BASE_URL }}
        SMOKE_ADMIN_EMAIL: ${{ secrets.SMOKE_ADMIN_EMAIL || 'admin@example.com' }}
        SMOKE_ADMIN_PASSWORD: ${{ secrets.SMOKE_ADMIN_PASSWORD || 'Password123!' }}
      run: npm run test:smoke -- tests/smoke/mysubsystem.smoke.test.ts
```

### 3. Update Summary Job

Add the new job to the `needs` and summary table in `smoke-summary` job.

## Best Practices

### What to Test

✅ **DO** test:
- Health endpoints return 200
- Key API endpoints respond
- Basic data shape is correct
- Database connectivity works
- Authentication works

❌ **DON'T** test:
- Business logic details
- Edge cases
- Data validation rules
- Complex workflows
- Performance characteristics

### Keep Tests Fast

- Single request per endpoint
- No complex setup/teardown
- Parallel execution enabled
- Timeout: 5-10 seconds per test

### Error Handling

Smoke tests should:
- Fail fast and clearly
- Provide actionable error messages
- Not retry or mask failures
- Surface deployment issues immediately

## Troubleshooting

### Tests Fail Locally

1. Ensure API is running: `docker compose ps`
2. Check API logs: `docker compose logs api`
3. Verify seeded data exists: `npm run db:seed -w @e-clat/data`
4. Check credentials match seeded admin user

### Tests Fail in CI/CD

1. Check API deployment succeeded
2. Verify API URL is accessible
3. Check secrets are configured correctly
4. Review smoke check logs in GitHub Actions
5. Verify database migrations ran successfully

### Debugging Failed Checks

```bash
# Run with verbose output
npm run test:smoke -- --reporter=verbose

# Run single subsystem
npm run test:smoke -- tests/smoke/auth.smoke.test.ts --reporter=verbose

# Check API health manually
curl -i https://api-dev.e-clat.azure.com/health
```

## Related Documentation

- [Pipeline Architecture Spec](../../docs/specs/pipeline-architecture-spec.md)
- [Parallel Deployment Requirements](../../docs/req/parallel-deployment-requirements.md)
- [CI/CD Workflows](../../.github/workflows/)
