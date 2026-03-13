# E-CLAT Documentation

Project-facing documentation for the E-CLAT codebase lives here. Team orchestration stays under `.squad/`; product and architecture artifacts live under `docs/` so the repository structure is unambiguous.

## Structure
```
docs/
├── adrs/        # Architecture decision records
└── prds/        # Product requirement documents and delivery plans
```

## Related tooling
```bash
# From repo root:
bash scripts/setup.sh         # Bootstrap local development
npm run dev -w @e-clat/api    # Start the API in dev mode
```

Use the repo-root `README.md` for the full workspace layout and day-one commands.
