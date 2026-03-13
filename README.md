# e-clat

**Workforce Readiness & Qualification Management System**

A compliance platform for regulated industries that tracks employee certifications, experience hours, medical clearances, and internal test results to maintain continuous proof of competency.

## Features

- **Qualification Management** — Track certifications, licenses, and credentials across multiple standards
- **Hour Aggregation** — Sync hours from clock-in/out, timesheets, job tickets, calendars, and manual entry
- **AI Document Processing** — OCR, classification, and expiration detection with human review
- **Medical Clearance Tracking** — Fit-for-duty status, visual acuity, and color vision results
- **Standards Framework Mapping** — Map requirements across multiple certification frameworks
- **RBAC** — Role-based access for employees, supervisors, managers, and compliance officers
- **Notification System** — Manager escalation, weekly compliance digests

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Run in development
npm run dev

# Build for production
npm run build
npm start

# Run tests
npm test
```

## Project Structure

```
src/
├── config/          # Environment and app configuration
├── common/          # Shared types, errors, utilities
│   ├── types/       # Domain types and enums
│   ├── errors/      # Custom error classes
│   └── utils/       # Logger, helpers
├── middleware/       # Auth, error handling, validation
└── modules/         # Feature modules
    ├── auth/        # Authentication & authorization
    ├── employees/   # Employee management
    ├── qualifications/  # Certification tracking
    ├── hours/       # Hour aggregation & sync
    ├── documents/   # AI document processing
    ├── standards/   # Compliance framework mapping
    ├── medical/     # Medical clearance tracking
    └── notifications/   # Alerts & digests
```

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express
- **Validation:** Zod
- **Auth:** JWT + bcrypt (RBAC)
- **Logging:** Winston
