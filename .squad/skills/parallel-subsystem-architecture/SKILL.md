---
name: "parallel-subsystem-architecture"
description: "How to audit a monorepo and propose subsystem boundaries, feature flags, and pipeline splits without forcing a rewrite"
domain: "architecture, ci-cd, service-design"
confidence: "high"
source: "earned while auditing E-CLAT API modules, frontend routes, Prisma schema, Terraform layers, and workflows for Daniels"
---

## Context
Use this skill when a monorepo has grown beyond a single team-friendly deploy cycle, but the codebase is not ready for a full microservice rewrite.

## Patterns
1. **Audit five planes together**
   - domain modules
   - frontend route/menu structure
   - shared contracts
   - data ownership
   - infra/workflow topology

2. **Separate logical service groups from runtime extraction**
   - define bounded contexts first
   - split CI/CD second
   - extract runtimes third

3. **Document singular ownership per aggregate**
   - one owner for each table/entity
   - consumers use contracts, query facades, or events

4. **Move cross-domain joins out of CRUD services**
   - readiness, digests, dashboards, and review queues belong in query layers

5. **Use simple feature flags first**
   - repo-backed registry
   - environment overrides
   - client-safe bootstrap endpoint
   - RBAC plus flag checks, never flags instead of RBAC

6. **Preserve shared infra layers while splitting compute**
   - keep foundation and data shared
   - split compute by service group when pipelines are ready

## Examples
- E-CLAT grouping:
  - Identity Platform
  - Workforce Core
  - Compliance Service
  - Records Service
  - Reference Data
  - Notification Service
- E-CLAT first migration step:
  - keep one API runtime
  - add contracts and pipeline separation
  - extract low-coupling services later

## Anti-Patterns
- rewriting a stable modular monolith just to say it is microservices
- splitting runtimes before contracts and path filters exist
- allowing domain services to own cross-domain dashboards
- creating a hosted feature-flag platform before simple config flags are operationally exhausted
- letting workflow names, Terraform outputs, and deploy target names drift apart