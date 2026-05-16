# DataScriba Deployment Guide

## Quick Deploy

```bash
git clone https://github.com/your-org/datascriba.git
cd datascriba
cp .env.example .env
# Edit .env (see Environment Variables below)
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d
curl http://localhost:3001/health
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection URL |
| `REDIS_HOST` | Yes | `127.0.0.1` | Redis host |
| `REDIS_PORT` | Yes | `6379` | Redis port |
| `REDIS_PASSWORD` | No | — | Redis password (required in production) |
| `ENCRYPTION_MASTER_KEY` | Yes | — | 64-char hex (32 bytes). `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key |
| `AI_MODEL` | No | `claude-sonnet-4-6` | Claude model ID |
| `AI_RATE_LIMIT_RPM` | No | `10` | AI rate limit (req/min/IP) |
| `API_PORT` | No | `3001` | API listen port |
| `NODE_ENV` | No | `development` | Set to `production` for prod |
| `BETTER_AUTH_SECRET` | Yes | — | 32+ char random string |
| `BETTER_AUTH_URL` | Yes | — | Public API URL |
| `NEXT_PUBLIC_API_URL` | Yes | — | Browser-facing API URL |
| `INTERNAL_API_URL` | Yes | `http://localhost:3001` | Worker-to-API URL |
| `SMTP_HOST` | No | — | SMTP host for notifications |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `SMTP_FROM` | No | — | Notification from address |

### Generating ENCRYPTION_MASTER_KEY

```bash
openssl rand -hex 32
```

Output is a 64-character hex string. Copy to `.env`.

**CRITICAL:** Changing this key after creating data sources makes existing connection strings
unreadable. Back up the key in a secrets manager.

## Healthcheck Endpoints

| Endpoint | Method | Expected |
|----------|--------|---------|
| `/health` | GET | `200 {"status":"ok"}` |

Docker uses `wget -qO- http://localhost:3001/health` with 30s interval.

## Production Checklist

- [ ] `NODE_ENV=production`
- [ ] `ENCRYPTION_MASTER_KEY` is a fresh value (not the example)
- [ ] `REDIS_PASSWORD` is strong and set
- [ ] `BETTER_AUTH_SECRET` is random and long
- [ ] `ANTHROPIC_API_KEY` is valid
- [ ] HTTPS termination via reverse proxy (nginx, Caddy, Traefik)
- [ ] Firewall: only expose ports 3000 (web) and 3001 (API) externally
- [ ] Docker volumes backed up regularly (postgres_data, redis_data, report_output)

## Updating

```bash
git pull
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml pull
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d --no-deps api worker
```

## Logs

```bash
docker compose logs -f api
docker compose logs -f worker
```
