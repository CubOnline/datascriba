# Contributing to DataScriba

## Development Environment

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 22 LTS |
| pnpm | 9+ |
| Docker | 24+ |
| Docker Compose | v2 |

### Setup

```bash
git clone https://github.com/your-org/datascriba.git
cd datascriba
pnpm install
cp .env.example .env
# Edit .env — set ENCRYPTION_MASTER_KEY and ANTHROPIC_API_KEY

docker compose -f docker/docker-compose.yml up postgres redis -d

# In separate terminals:
pnpm --filter=api dev
pnpm --filter=worker dev
pnpm --filter=web dev
```

## Multi-Agent Workflow

This project uses a 4-agent AI pipeline:

```
planner -> [user gate] -> builder -> reviewer -> tester -> done
```

| Agent | Responsibility |
|-------|---------------|
| planner | Analysis, task decomposition, TASK_PLAN.md |
| builder | TypeScript implementation |
| reviewer | Quality, security, correctness review |
| tester | Test coverage verification |

Key files: `TASK_PLAN.md` (planner), `PHASE_X_PROGRESS.md` (builder), `REVIEW.md` (reviewer), `TEST_REPORT.md` (tester).

## Code Standards

- TypeScript strict mode — no `any`, no `var`
- `console.log` banned — use Pino logger
- Named exports everywhere (Next.js page defaults excepted)
- Never swallow errors — log and re-throw
- Naming: `kebab-case` files, `PascalCase` classes, `camelCase` functions, `SCREAMING_SNAKE_CASE` constants

## Running Tests

```bash
pnpm test                         # All tests
pnpm test:coverage                # With coverage (target: 80%+)
pnpm --filter=api test            # API unit tests
pnpm --filter=api test:e2e        # API integration tests
pnpm --filter=report-engine test  # Package tests
```

## Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add PostgreSQL driver
fix: prevent path traversal in report output
chore: upgrade ExcelJS
docs: update architecture diagram
test: add csv-renderer edge cases
BREAKING: rename ExportFormat
```

## PR Rules

1. Every PR must include tests — reviewer will reject without coverage.
2. Branch from `develop`, not `main`.
3. Branch naming: `feat/<desc>`, `fix/<issue>`, `chore/<task>`.
4. PR title follows Conventional Commits.
5. Include: what changed and why, how to test, breaking changes flagged.
6. Do not merge your own PR.

## Architecture Decision Records

For decisions affecting DB strategy, new heavy dependencies, API breaking changes, or security
logic — create `docs/adr/00N-short-title.md` before implementing.
