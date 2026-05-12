# TASK_PLAN.md — Phase 1: Turborepo Monorepo + NestJS API Skeleton

**Agent:** builder
**Phase:** 1 — Temel Altyapı (monorepo scaffold + apps/api skeleton)
**Effort:** M (~3-4 hours)
**Created by:** planner
**Date:** 2026-05-12

---

## Context

- **Working directory (monorepo root):** `C:\Users\Cub\datascriba\Projects\datascriba`
- **Platform:** Windows 11, PowerShell
- **Package manager:** pnpm (install in Step 0 if missing)
- **Stack:** Turborepo 2.x + NestJS 10 + Fastify + Vitest + TypeScript 5.5 strict

---

## Prerequisites Verification

Before starting, confirm:
1. `node --version` returns `v22.x.x` or `v24.x.x`
2. Working directory is `C:\Users\Cub\datascriba\Projects\datascriba`
3. No existing `package.json` at the monorepo root (fresh scaffold)

---

## Steps

### Step 0 — Install pnpm globally

```powershell
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm --version   # Expected: 9.15.4
```

Fallback if corepack fails:
```powershell
npm install -g pnpm@9.15.4
```

---

### Step 1 — Create root `package.json`

**File:** `package.json`

```json
{
  "name": "datascriba",
  "version": "0.0.1",
  "private": true,
  "description": "DataScriba — Your AI-powered data scribe",
  "license": "Apache-2.0",
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "type-check": "turbo type-check",
    "format": "prettier --write \"**/*.{ts,tsx,js,json,md}\" --ignore-path .gitignore",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,json,md}\" --ignore-path .gitignore",
    "db:migrate": "pnpm --filter=@datascriba/api prisma migrate dev",
    "db:studio": "pnpm --filter=@datascriba/api prisma studio",
    "db:seed": "pnpm --filter=@datascriba/api prisma db seed",
    "docker:up": "docker compose -f docker/docker-compose.yml up -d",
    "docker:down": "docker compose -f docker/docker-compose.yml down"
  },
  "devDependencies": {
    "turbo": "^2.3.3",
    "prettier": "^3.3.3",
    "typescript": "^5.5.4"
  }
}
```

---

### Step 2 — Create `pnpm-workspace.yaml`

**File:** `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

### Step 3 — Create `turbo.json`

**File:** `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"],
      "inputs": ["$TURBO_DEFAULT$"]
    },
    "type-check": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env.test*"],
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "inputs": ["$TURBO_DEFAULT$"],
      "cache": false
    },
    "format:check": {
      "inputs": ["$TURBO_DEFAULT$"]
    }
  }
}
```

---

### Step 4 — Create root `tsconfig.base.json`

**File:** `tsconfig.base.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false
  },
  "exclude": ["node_modules"]
}
```

---

### Step 5 — Create `.prettierrc`

**File:** `.prettierrc`

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

---

### Step 6 — Create `.prettierignore`

**File:** `.prettierignore`

```
node_modules
dist
.turbo
coverage
*.lock
pnpm-lock.yaml
```

---

### Step 7 — Create `.eslintrc.js` (root)

**File:** `.eslintrc.js`

```js
// @ts-check
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./tsconfig.base.json', './apps/*/tsconfig.json', './packages/*/tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    'no-var': 'error',
    'no-console': 'error',
    eqeqeq: ['error', 'always'],
    'import/no-default-export': 'warn',
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      },
    ],
  },
  ignorePatterns: ['dist/', 'node_modules/', '.turbo/', 'coverage/', '*.js', '!.eslintrc.js'],
}
```

---

### Step 8 — Create `.gitignore`

**File:** `.gitignore`

```
# Dependencies
node_modules
.pnp
.pnp.js

# Build outputs
dist
build
.next
out

# Turbo
.turbo

# Environment files
.env
.env.local
.env.*.local
!.env.example

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea

# Test coverage
coverage

# Prisma
apps/api/src/generated

# TypeScript build info
*.tsbuildinfo

# Agent memory (sensitive)
.claude/agent-memory/**/*.local.md
```

---

### Step 9 — Create `.env.example`

**File:** `.env.example`

```
# Database
DATABASE_URL=postgresql://datascriba:datascriba@localhost:5432/datascriba

# Redis
REDIS_URL=redis://localhost:6379

# App
NODE_ENV=development
API_PORT=3001
API_HOST=0.0.0.0

# Auth
BETTER_AUTH_SECRET=change-this-to-a-random-32-char-string
BETTER_AUTH_URL=http://localhost:3001

# Encryption (AES-256-GCM master key for connection strings, 32-byte hex)
ENCRYPTION_MASTER_KEY=change-this-to-32-bytes-hex-value-xx

# AI
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-sonnet-4-6

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

### Step 10 — Create `packages/tsconfig/` shared config package

**File:** `packages/tsconfig/package.json`

```json
{
  "name": "@datascriba/tsconfig",
  "version": "0.0.1",
  "private": true,
  "license": "Apache-2.0",
  "files": ["*.json"],
  "exports": {
    "./base.json": "./base.json",
    "./nestjs.json": "./nestjs.json"
  }
}
```

**File:** `packages/tsconfig/base.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.base.json"
}
```

**File:** `packages/tsconfig/nestjs.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "target": "ES2022",
    "lib": ["ES2022"],
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "verbatimModuleSyntax": false,
    "isolatedModules": false,
    "strict": true,
    "noUncheckedIndexedAccess": false,
    "exactOptionalPropertyTypes": false,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts", "**/*e2e-spec.ts"]
}
```

> Note: `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are off for NestJS only — decorator and DI patterns are incompatible with those flags. All other strict flags remain on.

---

### Step 11 — Create `packages/eslint-config/` shared ESLint package

**File:** `packages/eslint-config/package.json`

```json
{
  "name": "@datascriba/eslint-config",
  "version": "0.0.1",
  "private": true,
  "license": "Apache-2.0",
  "main": "./index.js",
  "exports": {
    ".": "./index.js",
    "./nestjs": "./nestjs.js"
  },
  "peerDependencies": {
    "@typescript-eslint/eslint-plugin": ">=7.0.0",
    "@typescript-eslint/parser": ">=7.0.0",
    "eslint": ">=8.0.0",
    "eslint-config-prettier": ">=9.0.0",
    "eslint-plugin-import": ">=2.0.0"
  }
}
```

**File:** `packages/eslint-config/index.js`

```js
// @ts-check
/** @type {import('eslint').Linter.Config} */
module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    'no-var': 'error',
    'no-console': 'error',
    eqeqeq: ['error', 'always'],
    'import/no-default-export': 'warn',
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      },
    ],
  },
}
```

**File:** `packages/eslint-config/nestjs.js`

```js
// @ts-check
const base = require('./index')

/** @type {import('eslint').Linter.Config} */
module.exports = {
  ...base,
  rules: {
    ...base.rules,
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
  },
}
```

---

### Step 12 — Create `apps/api/package.json`

**File:** `apps/api/package.json`

```json
{
  "name": "@datascriba/api",
  "version": "0.0.1",
  "private": true,
  "license": "Apache-2.0",
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main",
    "start:prod": "NODE_ENV=production node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "lint:check": "eslint \"{src,test}/**/*.ts\"",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "format": "prettier --write \"{src,test}/**/*.ts\""
  },
  "dependencies": {
    "@nestjs/common": "^10.4.15",
    "@nestjs/core": "^10.4.15",
    "@nestjs/platform-fastify": "^10.4.15",
    "@nestjs/config": "^3.3.0",
    "@nestjs/swagger": "^8.1.0",
    "fastify": "^5.2.1",
    "zod": "^3.24.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@datascriba/eslint-config": "workspace:*",
    "@datascriba/tsconfig": "workspace:*",
    "@nestjs/cli": "^10.4.9",
    "@nestjs/testing": "^10.4.15",
    "@types/node": "^22.10.7",
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0",
    "@vitest/coverage-v8": "^2.1.9",
    "eslint": "^8.57.1",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-import": "^2.31.0",
    "prettier": "^3.3.3",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2",
    "typescript": "^5.5.4",
    "vitest": "^2.1.9"
  }
}
```

---

### Step 13 — Create `apps/api/tsconfig.json`

**File:** `apps/api/tsconfig.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@datascriba/tsconfig/nestjs.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {}
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts", "**/*e2e-spec.ts"]
}
```

---

### Step 14 — Create `apps/api/tsconfig.build.json`

**File:** `apps/api/tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts", "**/*e2e-spec.ts"]
}
```

---

### Step 15 — Create `apps/api/nest-cli.json`

**File:** `apps/api/nest-cli.json`

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": [],
    "watchAssets": false,
    "tsConfigPath": "tsconfig.build.json",
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "introspectComments": true,
          "controllerKeyOfTags": false
        }
      }
    ]
  }
}
```

---

### Step 16 — Create `apps/api/.eslintrc.js`

**File:** `apps/api/.eslintrc.js`

```js
// @ts-check
/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@datascriba/eslint-config/nestjs'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
}
```

---

### Step 17 — Create `apps/api/vitest.config.ts`

**File:** `apps/api/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['dist/**', 'node_modules/**', '**/*.spec.ts'],
    },
  },
})
```

---

### Step 18 — Create `apps/api/vitest.e2e.config.ts`

**File:** `apps/api/vitest.e2e.config.ts`

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    testTimeout: 30000,
  },
})
```

---

### Step 19 — Create `apps/api/src/main.ts`

**File:** `apps/api/src/main.ts`

```ts
import 'reflect-metadata'

import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { AppModule } from './app.module'

const logger = new Logger('Bootstrap')

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  )

  app.setGlobalPrefix('api/v1', { exclude: ['/health'] })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  )

  app.enableCors({
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
    credentials: true,
  })

  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('DataScriba API')
      .setDescription('Your AI-powered data scribe — REST API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build()

    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document)
    logger.log('Swagger UI available at /api/docs')
  }

  const port = process.env['API_PORT'] ? parseInt(process.env['API_PORT'], 10) : 3001
  const host = process.env['API_HOST'] ?? '0.0.0.0'

  await app.listen(port, host)
  logger.log(`DataScriba API running on http://${host}:${port}`)
  logger.log(`Environment: ${process.env['NODE_ENV'] ?? 'development'}`)
}

void bootstrap()
```

---

### Step 20 — Create `apps/api/src/app.module.ts`

**File:** `apps/api/src/app.module.ts`

```ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

---

### Step 21 — Create `apps/api/src/app.controller.ts`

**File:** `apps/api/src/app.controller.ts`

```ts
import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

import { AppService } from './app.service'

interface HealthResponse {
  status: 'ok'
  timestamp: string
  version: string
}

@ApiTags('System')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
        version: { type: 'string', example: '0.1.0' },
      },
    },
  })
  getHealth(): HealthResponse {
    return this.appService.getHealth()
  }
}
```

---

### Step 22 — Create `apps/api/src/app.service.ts`

**File:** `apps/api/src/app.service.ts`

```ts
import { Injectable } from '@nestjs/common'

interface HealthResponse {
  status: 'ok'
  timestamp: string
  version: string
}

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    }
  }
}
```

---

### Step 23 — Create `apps/api/src/app.controller.spec.ts`

**File:** `apps/api/src/app.controller.spec.ts`

```ts
import { Test, TestingModule } from '@nestjs/testing'
import { describe, it, expect, beforeEach } from 'vitest'

import { AppController } from './app.controller'
import { AppService } from './app.service'

describe('AppController', () => {
  let appController: AppController

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile()

    appController = app.get<AppController>(AppController)
  })

  describe('getHealth', () => {
    it('should return status ok', () => {
      const result = appController.getHealth()
      expect(result.status).toBe('ok')
    })

    it('should return a valid ISO timestamp', () => {
      const result = appController.getHealth()
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp)
    })

    it('should return version 0.1.0', () => {
      const result = appController.getHealth()
      expect(result.version).toBe('0.1.0')
    })
  })
})
```

---

### Step 24 — Create `apps/api/test/app.e2e-spec.ts`

**File:** `apps/api/test/app.e2e-spec.ts`

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'

import { AppModule } from '../src/app.module'

describe('AppController (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    )

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )

    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('GET /health', () => {
    it('returns 200 with ok status', async () => {
      const response = await supertest(app.getHttpServer())
        .get('/health')
        .expect(200)

      expect(response.body).toMatchObject({
        status: 'ok',
        version: '0.1.0',
      })
      expect(typeof response.body.timestamp).toBe('string')
    })
  })
})
```

---

### Step 25 — Create `packages/shared-types/` stub

**File:** `packages/shared-types/package.json`

```json
{
  "name": "@datascriba/shared-types",
  "version": "0.0.1",
  "private": true,
  "license": "Apache-2.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "eslint \"src/**/*.ts\""
  },
  "devDependencies": {
    "@datascriba/tsconfig": "workspace:*",
    "typescript": "^5.5.4"
  }
}
```

**File:** `packages/shared-types/tsconfig.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@datascriba/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "CommonJS",
    "moduleResolution": "Node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**File:** `packages/shared-types/src/index.ts`

```ts
export type { ApiResponse, PaginatedResponse } from './common'
```

**File:** `packages/shared-types/src/common.ts`

```ts
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
```

---

### Step 26 — Install all dependencies

Run from monorepo root:

```powershell
pnpm install
```

Expected: pnpm resolves workspace, generates `pnpm-lock.yaml`.

---

### Step 27 — Verify TypeScript compilation

```powershell
pnpm --filter=@datascriba/api run type-check
```

Expected: exits 0, no errors.

---

### Step 28 — Run the linter

```powershell
pnpm --filter=@datascriba/api run lint:check
```

Expected: exits 0 (warnings allowed, errors not).

---

### Step 29 — Run unit tests

```powershell
pnpm --filter=@datascriba/api run test
```

Expected: 3 tests pass in `src/app.controller.spec.ts`.

---

### Step 30 — Run e2e tests

```powershell
pnpm --filter=@datascriba/api run test:e2e
```

Expected: 1 test passes — `GET /health` returns 200.

---

### Step 31 — Verify Turbo build pipeline

```powershell
pnpm exec turbo build --filter=@datascriba/api
```

Expected: `apps/api/dist/main.js` exists.

---

### Step 32 — Smoke-test the running server (optional)

```powershell
# Terminal 1
pnpm --filter=@datascriba/api run dev

# Terminal 2
Invoke-RestMethod -Uri "http://localhost:3001/health"
```

Expected response: `{ status: 'ok', timestamp: '...', version: '0.1.0' }`

---

## Final Directory Structure

```
C:\Users\Cub\datascriba\Projects\datascriba\
├── apps/
│   └── api/
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── app.controller.ts
│       │   ├── app.controller.spec.ts
│       │   └── app.service.ts
│       ├── test/
│       │   └── app.e2e-spec.ts
│       ├── .eslintrc.js
│       ├── nest-cli.json
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       ├── vitest.config.ts
│       └── vitest.e2e.config.ts
├── packages/
│   ├── eslint-config/
│   │   ├── index.js
│   │   ├── nestjs.js
│   │   └── package.json
│   ├── shared-types/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── common.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── tsconfig/
│       ├── base.json
│       ├── nestjs.json
│       └── package.json
├── .env.example
├── .eslintrc.js
├── .gitignore
├── .prettierignore
├── .prettierrc
├── CLAUDE.md
├── ROADMAP.md
├── TASK_PLAN.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── turbo.json
```

---

## Acceptance Criteria

All must pass before builder marks this done:

- [ ] **AC-1:** `pnpm install` completes, generates `pnpm-lock.yaml`
- [ ] **AC-2:** `pnpm --filter=@datascriba/api run type-check` exits 0
- [ ] **AC-3:** `pnpm --filter=@datascriba/api run lint:check` exits 0
- [ ] **AC-4:** `pnpm --filter=@datascriba/api run test` — 3 unit tests pass
- [ ] **AC-5:** `pnpm --filter=@datascriba/api run test:e2e` — health e2e passes
- [ ] **AC-6:** `turbo build --filter=@datascriba/api` → `apps/api/dist/main.js` exists
- [ ] **AC-7:** `GET http://localhost:3001/health` → HTTP 200, `{ status: 'ok', version: '0.1.0' }`
- [ ] **AC-8:** No `any` type in any `.ts` file (confirmed by lint)
- [ ] **AC-9:** No `console.log` in any source file (confirmed by lint)
- [ ] **AC-10:** `pnpm-workspace.yaml` lists `apps/*` and `packages/*`
- [ ] **AC-11:** `turbo.json` defines all 6 tasks: `build`, `dev`, `lint`, `type-check`, `test`, `test:e2e`
- [ ] **AC-12:** `packages/tsconfig/nestjs.json` has `emitDecoratorMetadata: true` and `experimentalDecorators: true`

---

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| HTTP adapter | Fastify (not Express) | ~2x throughput, lower overhead |
| Test runner | Vitest (not Jest) | Faster, ESM native, no extra transform config for NestJS |
| Shared tsconfig | `packages/tsconfig/nestjs.json` | Reusable across future apps |
| `noUncheckedIndexedAccess` in NestJS preset | off | Incompatible with NestJS DI/decorator array patterns |
| pnpm version | 9.15.4 | Stable, supports `workspace:*` protocol |
| Turbo version | 2.3.3 | Latest stable with TUI and improved cache |

---

## Handoff to Builder

```
Ready for: builder agent
File: TASK_PLAN.md
Key risks:
  - pnpm not installed — Step 0 must succeed first
  - Windows CRLF: .prettierrc enforces LF — do not let git convert line endings
  - Fastify e2e: must call app.getHttpAdapter().getInstance().ready() before supertest
Next command: "Use the builder agent to execute TASK_PLAN.md"
```
