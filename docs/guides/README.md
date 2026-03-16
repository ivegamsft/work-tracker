# E-CLAT Documentation

Project-facing documentation for the E-CLAT codebase lives here. Team orchestration stays under `.squad/`; product and architecture artifacts live under `docs/` so the repository structure is unambiguous.

## Structure
```
docs/
├── ideas/         # Brainstorming, early feature module concepts
├── requirements/  # PRDs, product requirements, feature specs
├── specs/         # Architecture specs, API specs, technical designs
├── guides/        # General docs, READMEs, how-tos, wiring maps
├── tests/         # Test strategies and test plans
├── plans/         # Implementation plans and roadmaps
├── decisions/     # Architecture decision records
└── prompts/       # AI prompts and prompt frameworks
```

## Related tooling
```bash
# From repo root:
bash scripts/setup.sh         # Bootstrap local development
npm run dev -w @e-clat/api    # Start the API in dev mode
```

Use `docs/README.md` for the current category map and the repo-root `README.md` for the full workspace layout and day-one commands.
