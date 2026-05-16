# DataScriba API Reference

Base URL: `http://localhost:3001/api/v1`
Interactive docs: `http://localhost:3001/api/docs` (Swagger UI)

---

## Data Sources

### POST /data-sources

Create a data source.

**Request:**
```json
{
  "name": "Production MSSQL",
  "type": "mssql",
  "host": "db.example.com",
  "port": 1433,
  "database": "sales",
  "username": "reporter",
  "password": "s3cret",
  "encrypt": true,
  "trustServerCertificate": false,
  "connectionTimeoutMs": 30000
}
```

**Response 201:**
```json
{
  "id": "ds-uuid",
  "name": "Production MSSQL",
  "type": "mssql",
  "host": "db.example.com",
  "port": 1433,
  "database": "sales",
  "username": "reporter",
  "encryptedConnectionString": "[REDACTED]",
  "workspaceId": "default",
  "createdAt": "2026-05-16T10:00:00.000Z",
  "updatedAt": "2026-05-16T10:00:00.000Z"
}
```

### GET /data-sources

List all data sources (passwords always redacted).

### GET /data-sources/:id

Get one data source. **404** if not found.

### PUT /data-sources/:id

Update. All fields optional.

### DELETE /data-sources/:id

**204** on success. **404** if not found.

### POST /data-sources/:id/test

Test database connection.

**Response 200:** `{ "success": true }` or `{ "success": false, "error": "..." }`

### GET /data-sources/:id/tables

**Response 200:** `[{ "schema": "dbo", "name": "users", "type": "TABLE" }]`

### GET /data-sources/:id/tables/:tableName/columns

**Response 200:** `[{ "name": "id", "dataType": "int", "nullable": false, "isPrimaryKey": true, "defaultValue": null }]`

---

## Reports

### POST /reports

Create a report definition.

**Request:**
```json
{
  "name": "Monthly Sales",
  "dataSourceId": "ds-uuid",
  "query": "SELECT region, SUM(amount) AS total FROM sales WHERE month = {{month}} GROUP BY region",
  "exportFormats": ["csv", "excel"],
  "parameters": [
    { "name": "month", "type": "string", "label": "Month", "required": true }
  ]
}
```

**Response 201:** ReportDefinition.

### GET /reports

List all reports.

### GET /reports/:id

Get one report. **404** if not found.

### PUT /reports/:id

Update. All fields optional.

### DELETE /reports/:id

**204** on success.

### POST /reports/:id/run

Execute report synchronously. Returns file as binary.

**Request:** `{ "format": "csv", "parameters": { "month": "2026-05" } }`

**Response 200:**
- CSV: `Content-Type: text/csv; charset=utf-8`
- Excel: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="<report-name>-<runId>.<ext>"`
- Body: raw file bytes

**Errors:** 400 invalid format, 400 missing required parameters, 404 report not found.

### GET /reports/:id/runs

Run history for a report.

**Response 200:**
```json
[{
  "id": "run-uuid",
  "reportId": "rpt-uuid",
  "status": "completed",
  "format": "csv",
  "parameters": {},
  "startedAt": "2026-05-16T10:00:00.000Z",
  "completedAt": "2026-05-16T10:00:02.000Z"
}]
```

### GET /reports/:id/runs/:runId

Get single run record.

---

## Schedules

### POST /schedules

Create a schedule. `cronExpression` validated by `cron-parser` — invalid expressions return 400.

**Request:**
```json
{
  "reportId": "rpt-uuid",
  "cronExpression": "0 9 * * 1",
  "format": "excel",
  "enabled": true,
  "notifyEmail": "manager@company.com"
}
```

**Response 201:** ScheduleDefinition.

### GET /schedules

List all schedules.

### GET /schedules/:id

Get one schedule.

### PUT /schedules/:id

Update. All fields optional.

### DELETE /schedules/:id

**204** on success.

### POST /schedules/:id/trigger

Manually enqueue a BullMQ job immediately.

**Response 200:** `{ "jobId": "bullmq-job-id" }`

---

## AI (Scriba AI)

All AI endpoints rate-limited (default: 10 RPM per IP, configurable via `AI_RATE_LIMIT_RPM`).

### POST /ai/suggest-query

**Content-Type (response):** `text/event-stream`

**Request:** `{ "prompt": "Show total sales per region", "dataSourceId": "ds-uuid" }`

**SSE events:**
```
data: {"type":"delta","text":"SELECT "}
data: {"type":"delta","text":"region"}
data: {"type":"done"}
```

| Event type | Fields | Meaning |
|-----------|--------|---------|
| `delta` | `text: string` | SQL token chunk |
| `done` | — | Stream complete |
| `error` | `error: string` | Error occurred |

### POST /ai/explain-query

Non-streaming. Explains SQL in Turkish and English.

**Request:** `{ "sql": "SELECT * FROM users" }`

**Response 200:**
```json
{
  "turkish": "Bu sorgu tum kullanicilari getirir.",
  "english": "This query retrieves all users.",
  "model": "claude-sonnet-4-6"
}
```

### POST /ai/fix-query

**Content-Type (response):** `text/event-stream`

**Request:** `{ "sql": "SELEC * FORM users", "errorMessage": "Incorrect syntax near SELEC" }`

Same SSE format as `suggest-query`.

---

## Health

### GET /health

**Response 200:** `{ "status": "ok", "timestamp": "2026-05-16T10:00:00.000Z" }`
