# Freamon Decision: Category-based documentation taxonomy

- **Status:** Accepted
- **Date:** 2026-03-16

## Context
The repository had durable documentation split across `docs/`, `docs/prds/`, `docs/architecture/`, `docs/adrs/`, and `prompts/workforce-compliance-tracker/`. That layout mixed actual AI prompts with ideas, plans, and decision notes, which made navigation and link maintenance harder.

## Decision
Standardize project-facing markdown under `docs/` by purpose:
- `ideas/`
- `requirements/`
- `specs/`
- `guides/`
- `tests/`
- `plans/`
- `decisions/`
- `prompts/`

Actual prompt assets stay in `docs/prompts/`; brainstorming, plans, and decision records move to their own categories instead of remaining inside the prompt pack.

## Consequences
- New docs should be filed by document purpose, not by historical source folder.
- Relative links should target `requirements/`, `specs/`, `tests/`, and the other category folders rather than the retired `prds/`, `architecture/`, `adrs/`, or top-level `prompts/` trees.
- The old `prompts/`, `docs/prds/`, `docs/architecture/`, and `docs/adrs/` directories are retired once empty.
