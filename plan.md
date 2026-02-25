# Multi-Tenant Authentication & Authorization Service — Implementation Plan

> This document serves as a reproducible blueprint. Feed it to an LLM to regenerate the project from scratch or use it as a base for modifications.

---

## 1. Context & Goals

Build a greenfield multi-tenant authentication and authorization service that supports:

- **Local authentication** (email + password)
- **OAuth2 providers** (Google, Microsoft, extensible via strategy pattern)
- **SAML 2.0 SSO** (SP-initiated, per-tenant IdP configuration)
- **Multi-tenant RBAC** — users belong to multiple tenants, each with per-tenant roles and permissions
- **Admin APIs** — manage auth provider configurations including SAML certificates/fingerprints

The service is designed as a standalone backend API. It does not include a frontend.

---

## 2. Tech Stack

| Layer          | Technology                                      |
|----------------|------------------------------------------------|
| Runtime        | Node.js + TypeScript (ESM, `"type": "module"`) |
| Framework      | Express 4                                       |
| ORM            | Prisma (type-safe schema, declarative migrations) |
| Database       | PostgreSQL (shared DB, `tenant_id` column pattern) |
| Auth tokens    | JWT access tokens (HS256, 15min) + opaque refresh tokens (SHA-256 hashed, 7-day expiry, family-based rotation) |
| Testing        | Vitest + Supertest                              |
| Validation     | Zod (request body, query, params)               |
| Logging        | Pino (with pino-pretty for dev)                 |
| Security       | Helmet, CORS, express-rate-limit, bcryptjs, AES-256-GCM field encryption |
| SAML           | @node-saml/passport-saml                        |
| Container      | Docker (Dockerfile) + Docker Compose (PostgreSQL) |

---

## 3. Project Structure

```
src/
├── index.ts                        # Entry point — loads env, starts server, graceful shutdown
├── app.ts                          # Express app factory — middleware stack + route mounting
├── test-setup.ts                   # Vitest setup — sets test env vars
├── config/
│   ├── env.ts                      # Zod-validated environment config (DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, etc.)
│   └── database.ts                 # Prisma client singleton
├── middleware/
│   ├── authenticate.ts             # Verifies JWT Bearer token, sets req.userId/tenantId/role/permissions
│   ├── authorize.ts                # Checks req.permissions against required permissions
│   ├── tenantContext.ts            # Extracts tenant from token or route params, validates tenant match
│   ├── validate.ts                 # Generic Zod validation for body/query/params
│   ├── rateLimiter.ts              # Global (200/min) and auth-specific (20/15min) rate limiters
│   └── errorHandler.ts            # Catches AppError, ZodError, and unknown errors → JSON responses
├── modules/
│   ├── auth/
│   │   ├── auth.routes.ts          # POST /auth/login, /register, /refresh, /logout + mounts oauth/saml subrouters
│   │   ├── auth.service.ts         # Orchestrates register, login, refresh, logout, OAuth/SAML login
│   │   ├── oauth.routes.ts         # GET /auth/oauth/start, /auth/oauth/callback
│   │   ├── saml.routes.ts          # GET /auth/saml/start, POST /auth/saml/callback, GET /auth/saml/metadata/:tenantId
│   │   └── strategies/
│   │       ├── auth-strategy.ts    # AuthStrategy interface + AuthResult type
│   │       ├── index.ts            # Strategy registry (Map<string, AuthStrategy>), registers all built-in strategies
│   │       ├── local.strategy.ts   # Email+password auth via bcrypt
│   │       ├── google.strategy.ts  # Google OAuth2 authorization code flow
│   │       ├── microsoft.strategy.ts # Microsoft OAuth2 authorization code flow
│   │       └── saml.strategy.ts    # SAML SP-initiated SSO
│   ├── tokens/
│   │   └── token.service.ts        # JWT issuance/verification, refresh token create/rotate/revoke with reuse detection
│   ├── users/
│   │   ├── user.routes.ts          # GET /users/me, PATCH /users/me/password, GET /users/me/linked-accounts
│   │   └── user.service.ts         # Profile retrieval, password change, linked accounts list
│   ├── tenants/
│   │   ├── tenant.routes.ts        # CRUD /tenants + /tenants/:id/members management
│   │   └── tenant.service.ts       # Tenant CRUD, member add/update/remove, creates default roles on tenant creation
│   ├── providers/
│   │   ├── provider.routes.ts      # CRUD /tenants/:id/providers (OAuth + SAML sub-endpoints)
│   │   └── provider.service.ts     # Provider CRUD with secret encryption/masking
│   └── rbac/
│       ├── rbac.routes.ts          # CRUD /tenants/:id/roles + PUT /tenants/:id/roles/:roleId/permissions, GET /tenants/permissions
│       └── rbac.service.ts         # Role CRUD, permission resolution, default role creation (admin + member)
├── lib/
│   ├── errors.ts                   # AppError hierarchy: Unauthorized, Forbidden, NotFound, Conflict, Validation, RateLimit
│   ├── logger.ts                   # Pino logger (silent in test, pretty in dev)
│   ├── crypto.ts                   # hashPassword, verifyPassword, sha256, generateRandomToken, encrypt/decrypt (AES-256-GCM), hmacSign, timingSafeEqual
│   ├── rls.ts                      # withTenantContext() for Prisma transactions + RLS policy SQL
│   └── saml-utils.ts               # computeCertFingerprint, validateCertFingerprint, generateSpMetadata, parseIdpMetadata
├── types/
│   └── express.d.ts                # Augments Express.Request with userId, tenantId, role, permissions
└── __tests__/
    ├── health.test.ts              # Health endpoint returns 200 + status ok
    ├── crypto.test.ts              # bcrypt, SHA-256, AES-256-GCM, HMAC, timingSafeEqual
    ├── tokens.test.ts              # JWT issue + verify, invalid token rejection
    ├── validate.test.ts            # Zod middleware passes valid, rejects invalid with 422
    ├── errors.test.ts              # Each error class returns correct status code + structure
    └── saml-utils.test.ts          # Cert fingerprint computation, validation, SP metadata generation

prisma/
├── schema.prisma                   # Full data model (11 models, 2 enums)
├── seed.ts                         # Seeds 16 default permissions
└── migrations/                     # Auto-generated by `prisma migrate dev`

# Root files
├── package.json                    # Dependencies, scripts (dev, build, test, lint, db:migrate, db:seed)
├── tsconfig.json                   # Strict, ESM, NodeNext module resolution
├── vitest.config.ts                # Vitest config with test-setup.ts
├── docker-compose.yml              # PostgreSQL 16-alpine on port 5432
├── Dockerfile                      # Multi-stage build (builder + runner)
├── .env.example                    # Template for environment variables
├── .gitignore                      # node_modules, dist, .env, coverage
├── AUTH_PROVIDERS_GUIDE.md         # Setup guide for Google, Microsoft, SAML providers
└── ERD.md                          # Entity relationship diagram and table documentation
```

---

## 4. Database Schema

### 4.1 Models

#### users (global)
- `id` UUID PK
- `email` VARCHAR UNIQUE
- `password_hash` VARCHAR NULLABLE (null for OAuth/SAML-only users)
- `display_name` VARCHAR
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

#### tenants (global)
- `id` UUID PK
- `name` VARCHAR
- `slug` VARCHAR UNIQUE
- `domain` VARCHAR UNIQUE NULLABLE (for email domain auto-join)
- `created_at`, `updated_at` TIMESTAMPTZ

#### tenant_memberships (tenant-scoped, RLS)
- `id` UUID PK
- `user_id` FK -> users, CASCADE
- `tenant_id` FK -> tenants, CASCADE
- `role_id` FK -> roles
- `status` ENUM (ACTIVE, INACTIVE, INVITED), default ACTIVE
- `joined_at` TIMESTAMPTZ
- UNIQUE(`user_id`, `tenant_id`)

#### linked_accounts (global)
- `id` UUID PK
- `user_id` FK -> users, CASCADE
- `provider_type` VARCHAR (google, microsoft, saml)
- `provider_user_id` VARCHAR
- `access_token` VARCHAR NULLABLE (encrypted)
- `refresh_token` VARCHAR NULLABLE (encrypted)
- `created_at`, `updated_at` TIMESTAMPTZ
- UNIQUE(`provider_type`, `provider_user_id`)

#### roles (tenant-scoped, RLS)
- `id` UUID PK
- `tenant_id` FK -> tenants, CASCADE
- `name` VARCHAR
- `is_system` BOOLEAN default false
- UNIQUE(`tenant_id`, `name`)

#### permissions (global)
- `id` UUID PK
- `resource` VARCHAR
- `action` VARCHAR
- UNIQUE(`resource`, `action`)

#### role_permissions (tenant-scoped via role, RLS)
- `id` UUID PK
- `role_id` FK -> roles, CASCADE
- `permission_id` FK -> permissions, CASCADE
- UNIQUE(`role_id`, `permission_id`)

#### auth_providers (tenant-scoped, RLS)
- `id` UUID PK
- `tenant_id` FK -> tenants, CASCADE
- `type` ENUM (GOOGLE, MICROSOFT, SAML)
- `enabled` BOOLEAN default false
- UNIQUE(`tenant_id`, `type`)

#### oauth_provider_configs (tenant-scoped, RLS)
- `id` UUID PK
- `auth_provider_id` FK -> auth_providers, UNIQUE, CASCADE
- `tenant_id` VARCHAR (denormalized for RLS)
- `client_id` VARCHAR
- `client_secret` VARCHAR (AES-256-GCM encrypted)
- `scopes` VARCHAR default "openid email profile"
- `auth_url`, `token_url`, `user_info_url` VARCHAR NULLABLE (custom endpoint overrides)

#### saml_provider_configs (tenant-scoped, RLS)
- `id` UUID PK
- `auth_provider_id` FK -> auth_providers, UNIQUE, CASCADE
- `tenant_id` VARCHAR (denormalized for RLS)
- `entity_id` VARCHAR
- `sso_url` VARCHAR
- `certificate` TEXT NULLABLE
- `certificate_fingerprint` VARCHAR NULLABLE
- `signature_algorithm` VARCHAR default "sha256"
- `digest_algorithm` VARCHAR default "sha256"
- `metadata_xml` TEXT NULLABLE

#### refresh_tokens (tenant-scoped, RLS)
- `id` UUID PK
- `token_hash` VARCHAR UNIQUE (SHA-256 of raw token)
- `user_id` FK -> users, CASCADE
- `tenant_id` FK -> tenants, CASCADE
- `family_id` UUID (groups tokens in a rotation chain)
- `expires_at` TIMESTAMPTZ (7 days)
- `revoked_at` TIMESTAMPTZ NULLABLE
- `replaced_by` UUID NULLABLE (points to successor token)
- `created_at` TIMESTAMPTZ

### 4.2 Enums

- **MembershipStatus**: ACTIVE, INACTIVE, INVITED
- **ProviderType**: GOOGLE, MICROSOFT, SAML

### 4.3 Seed Data

16 permissions seeded on setup:

| Resource  | Actions                    |
|-----------|----------------------------|
| users     | read, write, delete        |
| tenants   | read, write, delete        |
| members   | read, write, delete        |
| roles     | read, write, delete        |
| providers | read, write, delete, manage|

### 4.4 Default Roles (per tenant)

Created automatically when a tenant is created:

- **admin** (isSystem=true): All 16 permissions
- **member** (isSystem=true): All `read` permissions only (5 permissions)

---

## 5. Authentication Architecture

### 5.1 Strategy Pattern

All auth providers implement the `AuthStrategy` interface:

```typescript
interface AuthStrategy {
  readonly type: string;
  getAuthorizationUrl?(tenantId: string, state: string): Promise<string | null>;
  authenticate(params: Record<string, unknown>): Promise<AuthResult>;
}

interface AuthResult {
  userId: string;
  email: string;
  displayName: string;
  providerType: string;
  providerUserId: string;
  isNewUser: boolean;
}
```

Strategies are registered in a `Map<string, AuthStrategy>` registry. Adding a new provider = one new file implementing `AuthStrategy` + one `registerStrategy()` call.

### 5.2 Local Auth Flow

1. **Register**: Validate input -> check tenant exists -> check user uniqueness -> bcrypt hash (cost 12) -> create user + membership with default "member" role -> issue token pair
2. **Login**: Validate input -> LocalStrategy.authenticate (find user by email, verify bcrypt) -> verify tenant membership is ACTIVE -> resolve permissions -> issue token pair
3. **Refresh**: Validate raw token -> SHA-256 hash -> find in DB -> check not revoked (reuse detection: if revoked, revoke entire family) -> check not expired -> create new token in same family -> revoke old token -> resolve current role/permissions -> issue new access token + new refresh token
4. **Logout**: SHA-256 hash the raw token -> find token -> revoke entire family

### 5.3 OAuth2 Flow (Google / Microsoft)

1. **Start** (`GET /auth/oauth/start?provider=google&tenant=UUID`):
   - Load tenant-specific OAuth config from DB
   - Generate state = `tenantId:nonce:hmac_signature` (HMAC-SHA256 with JWT_SECRET)
   - Store state in memory map with 10-minute expiry
   - Redirect to provider's authorization URL
2. **Callback** (`GET /auth/oauth/callback?code=...&state=...`):
   - Validate state signature (timing-safe comparison)
   - Look up pending state, verify not expired
   - Call strategy.authenticate(code, tenantId):
     - Exchange authorization code for tokens at provider's token endpoint
     - Fetch user info from provider's userinfo endpoint
     - Return normalized AuthResult
   - handleOAuthOrSamlLogin: find/create linked_account, find/create user, ensure tenant membership, issue token pair

**Google specifics**: Uses `accounts.google.com` auth/token URLs, `googleapis.com/oauth2/v3/userinfo`, `access_type=offline`, `prompt=consent`

**Microsoft specifics**: Uses `login.microsoftonline.com/common/oauth2/v2.0` auth/token URLs, `graph.microsoft.com/v1.0/me`, supports single-tenant via custom URLs

### 5.4 SAML Flow

1. **Start** (`GET /auth/saml/start?tenant=UUID`):
   - Load tenant-specific SAML config from DB
   - Generate HMAC-signed state (same as OAuth)
   - Build SAML AuthnRequest XML, base64 encode
   - Redirect to IdP's SSO URL with SAMLRequest + RelayState
2. **Callback** (`POST /auth/saml/callback`):
   - Validate RelayState signature
   - Decode SAMLResponse (base64)
   - Extract NameID as user identity
   - handleOAuthOrSamlLogin (same as OAuth)
3. **Metadata** (`GET /auth/saml/metadata/:tenantId`):
   - Generate SP metadata XML with entity ID and ACS URL

### 5.5 Token System

**Access Token** (JWT, HS256):
- Expiry: 15 minutes
- Payload: `sub` (userId), `tid` (tenantId), `role` (role name), `permissions` (string array)
- Permissions are resolved at issuance and refresh — changes take effect on next refresh

**Refresh Token** (opaque):
- 64 random bytes, hex encoded (128 chars)
- Stored as SHA-256 hash in DB
- 7-day expiry
- Family-based rotation: each rotation creates a new token in the same `family_id`, revokes the old one
- Reuse detection: if a revoked token is presented, the entire family is revoked (possible theft)

---

## 6. API Routes

### Auth (`/auth`)
| Method | Path                          | Auth | Description                    |
|--------|-------------------------------|------|--------------------------------|
| POST   | /auth/register                | No   | Create user + tenant membership|
| POST   | /auth/login                   | No   | Authenticate + get tokens      |
| POST   | /auth/refresh                 | No   | Rotate refresh token           |
| POST   | /auth/logout                  | No   | Revoke refresh token family    |
| GET    | /auth/oauth/start             | No   | Start OAuth flow (redirect)    |
| GET    | /auth/oauth/callback          | No   | OAuth callback                 |
| GET    | /auth/saml/start              | No   | Start SAML flow (redirect)     |
| POST   | /auth/saml/callback           | No   | SAML assertion callback        |
| GET    | /auth/saml/metadata/:tenantId | No   | SP metadata XML                |

### Users (`/users`)
| Method | Path                    | Auth     | Permission | Description           |
|--------|-------------------------|----------|------------|-----------------------|
| GET    | /users/me               | Required | —          | Get own profile       |
| PATCH  | /users/me/password      | Required | —          | Change own password   |
| GET    | /users/me/linked-accounts| Required | —         | List linked accounts  |

### Tenants (`/tenants`)
| Method | Path                              | Auth     | Permission      | Description            |
|--------|-----------------------------------|----------|-----------------|------------------------|
| POST   | /tenants                          | Required | —               | Create tenant (creator becomes admin) |
| GET    | /tenants/:tenantId                | Required | tenants:read    | Get tenant details     |
| PATCH  | /tenants/:tenantId                | Required | tenants:write   | Update tenant          |
| DELETE | /tenants/:tenantId                | Required | tenants:delete  | Delete tenant          |
| GET    | /tenants/:tenantId/members        | Required | members:read    | List members           |
| POST   | /tenants/:tenantId/members        | Required | members:write   | Add member             |
| PATCH  | /tenants/:tenantId/members/:userId| Required | members:write   | Update member role/status |
| DELETE | /tenants/:tenantId/members/:userId| Required | members:delete  | Remove member          |

### Providers (`/tenants/:tenantId/providers`)
| Method | Path                                            | Auth     | Permission       | Description              |
|--------|-------------------------------------------------|----------|------------------|--------------------------|
| GET    | /tenants/:tenantId/providers                    | Required | providers:read   | List all providers       |
| GET    | /tenants/:tenantId/providers/:providerId        | Required | providers:read   | Get provider details     |
| POST   | /tenants/:tenantId/providers/oauth               | Required | providers:manage | Create OAuth provider    |
| PATCH  | /tenants/:tenantId/providers/:providerId/oauth   | Required | providers:manage | Update OAuth config      |
| POST   | /tenants/:tenantId/providers/saml                | Required | providers:manage | Create SAML provider     |
| PATCH  | /tenants/:tenantId/providers/:providerId/saml    | Required | providers:manage | Update SAML config       |
| DELETE | /tenants/:tenantId/providers/:providerId         | Required | providers:manage | Delete provider          |

### RBAC (`/tenants/:tenantId/roles`)
| Method | Path                                              | Auth     | Permission   | Description              |
|--------|---------------------------------------------------|----------|--------------|--------------------------|
| GET    | /tenants/permissions                              | Required | —            | List all system permissions |
| GET    | /tenants/:tenantId/roles                          | Required | roles:read   | List tenant roles        |
| POST   | /tenants/:tenantId/roles                          | Required | roles:write  | Create custom role       |
| GET    | /tenants/:tenantId/roles/:roleId                  | Required | roles:read   | Get role with permissions|
| PATCH  | /tenants/:tenantId/roles/:roleId                  | Required | roles:write  | Rename role              |
| DELETE | /tenants/:tenantId/roles/:roleId                  | Required | roles:delete | Delete role (non-system) |
| PUT    | /tenants/:tenantId/roles/:roleId/permissions      | Required | roles:write  | Set role permissions     |

---

## 7. Middleware Stack

Applied in order by the Express app:

1. **helmet()** — security headers
2. **cors()** — CORS whitelist from `CORS_ORIGINS` env var
3. **express.json()** — JSON body parsing
4. **cookieParser()** — cookie parsing
5. **globalLimiter** — 200 requests/minute (skipped in test)
6. **authLimiter** — 20 requests/15min on `/auth` routes (skipped in test)
7. **Route-level middleware** (per route):
   - `authenticate` — JWT verification
   - `tenantFromParams()` — extracts and validates tenant ID from route params
   - `authorize(...permissions)` — permission check
   - `validate({ body, query, params })` — Zod schema validation
8. **errorHandler** — global error handler (last)

---

## 8. Security Measures

| Measure | Implementation |
|---------|---------------|
| Password hashing | bcrypt, cost factor 12 |
| JWT signing | HS256 with dedicated secret (min 32 chars) |
| Field encryption | AES-256-GCM for OAuth client secrets and linked account tokens (IV:authTag:ciphertext format) |
| Token storage | Refresh tokens stored as SHA-256 hashes, never in plaintext |
| Token comparison | Timing-safe string comparison for state/signature validation |
| OAuth state | HMAC-SHA256 signed with JWT_SECRET, includes tenantId + nonce, 10-minute expiry |
| Refresh rotation | Family-based rotation with reuse detection (revokes entire family on replay) |
| Rate limiting | 200 req/min global, 20 auth attempts/15min |
| Security headers | Helmet defaults (CSP, HSTS, X-Frame-Options, etc.) |
| CORS | Whitelist from env, credentials enabled |
| Secret masking | OAuth client secrets always returned as `••••••••` in API responses |
| Input validation | Zod schemas on all request bodies, query params, and route params |
| SAML | Certificate/fingerprint validation, SP metadata endpoint |

---

## 9. Environment Variables

| Variable       | Required | Description                                    | Example                                |
|----------------|----------|------------------------------------------------|----------------------------------------|
| NODE_ENV       | No       | development, production, test (default: development) | development                      |
| PORT           | No       | Server port (default: 3000)                    | 3000                                   |
| DATABASE_URL   | Yes      | PostgreSQL connection string                   | postgresql://user@localhost:5432/auth_db |
| JWT_SECRET     | Yes      | JWT signing secret (min 32 chars)              | change-me-to-a-secure-random-string    |
| ENCRYPTION_KEY | Yes      | AES-256 key as 64 hex characters (32 bytes)    | 0123456789abcdef...                    |
| CORS_ORIGINS   | No       | Comma-separated allowed origins                | http://localhost:3000                  |
| BASE_URL       | No       | Public URL of the service (for OAuth redirects)| http://localhost:3000                  |

---

## 10. Implementation Phases

### Phase 1: Project Skeleton
1. Initialize project: `package.json` (ESM, scripts), `tsconfig.json` (strict, NodeNext), `vitest.config.ts`
2. Install dependencies (express, prisma, bcryptjs, jsonwebtoken, zod, helmet, cors, pino, etc.)
3. Create directory structure: `src/{config,middleware,modules,lib,types}`, `prisma/`
4. Implement `src/config/env.ts` — Zod-validated env loading
5. Implement `src/config/database.ts` — Prisma client singleton
6. Implement `src/lib/logger.ts` — Pino logger
7. Implement `src/lib/errors.ts` — Error class hierarchy
8. Implement `src/middleware/errorHandler.ts` — Express error handler
9. Implement `src/middleware/validate.ts` — Zod validation middleware
10. Implement `src/types/express.d.ts` — Express Request augmentation
11. Implement `src/app.ts` — Express app factory with middleware + route mounting
12. Implement `src/index.ts` — Entry point with graceful shutdown
13. Create stub route files for all modules
14. Create `docker-compose.yml`, `Dockerfile`, `.env.example`, `.gitignore`
15. Verify: `npm install` succeeds, TypeScript compiles

### Phase 2: Database Schema
1. Write `prisma/schema.prisma` with all 11 models and 2 enums
2. Map all table/column names to snake_case via `@@map` / `@map`
3. Define all relationships, cascades, and unique constraints
4. Run `npx prisma generate` to generate the client
5. Write `prisma/seed.ts` with 16 default permissions
6. Implement `src/lib/rls.ts` — `withTenantContext()` helper + RLS policy SQL
7. Verify: Prisma client generates without errors

### Phase 3: Local Auth + Tokens
1. Implement `src/lib/crypto.ts` — hashPassword, verifyPassword, sha256, generateRandomToken, encrypt/decrypt, hmacSign, timingSafeEqual
2. Implement `src/modules/tokens/token.service.ts` — issueAccessToken, verifyAccessToken, createRefreshToken, rotateRefreshToken (with reuse detection), revokeRefreshTokenFamily, revokeAllUserTokens, issueTokenPair
3. Implement `src/modules/auth/strategies/auth-strategy.ts` — AuthStrategy interface + AuthResult type
4. Implement `src/modules/auth/strategies/local.strategy.ts` — email+password via bcrypt
5. Implement `src/modules/auth/strategies/index.ts` — strategy registry
6. Implement `src/modules/auth/auth.service.ts` — register, login, refresh, logout, handleOAuthOrSamlLogin
7. Implement `src/middleware/authenticate.ts` — JWT Bearer token verification
8. Implement `src/modules/auth/auth.routes.ts` — POST /login, /register, /refresh, /logout with Zod schemas
9. Implement `src/modules/users/user.service.ts` — getProfile, changePassword, getLinkedAccounts
10. Implement `src/modules/users/user.routes.ts` — GET /me, PATCH /me/password, GET /me/linked-accounts
11. Write tests: crypto.test.ts, tokens.test.ts

### Phase 4: Tenants + RBAC
1. Implement `src/modules/rbac/rbac.service.ts` — resolvePermissions, createRole, getRoles, getRole, updateRole, deleteRole, setRolePermissions, getAllPermissions, createDefaultRoles
2. Implement `src/modules/tenants/tenant.service.ts` — createTenant (with default roles), getTenant, updateTenant, deleteTenant, getMembers, addMember, updateMember, removeMember
3. Implement `src/middleware/authorize.ts` — permission check middleware
4. Implement `src/middleware/tenantContext.ts` — tenantContext + tenantFromParams middleware
5. Implement `src/modules/tenants/tenant.routes.ts` — CRUD + member management routes
6. Implement `src/modules/rbac/rbac.routes.ts` — Role CRUD + permission assignment routes

### Phase 5: OAuth2 Providers
1. Implement `src/modules/auth/strategies/google.strategy.ts` — Google OAuth2 (auth URL, code exchange, userinfo)
2. Implement `src/modules/auth/strategies/microsoft.strategy.ts` — Microsoft OAuth2 (same pattern, MS-specific URLs)
3. Register both strategies in `strategies/index.ts`
4. Implement `src/modules/auth/oauth.routes.ts` — GET /start (state generation, redirect), GET /callback (state validation, code exchange, login)
5. Implement `src/modules/providers/provider.service.ts` — CRUD for OAuth and SAML providers with secret encryption/masking
6. Implement `src/modules/providers/provider.routes.ts` — Provider admin API routes
7. Mount oauth routes in auth.routes.ts

### Phase 6: SAML
1. Implement `src/lib/saml-utils.ts` — computeCertFingerprint, validateCertFingerprint, generateSpMetadata, parseIdpMetadata
2. Implement `src/modules/auth/strategies/saml.strategy.ts` — SAML SP-initiated SSO (AuthnRequest generation, response parsing)
3. Register SAML strategy in registry
4. Implement `src/modules/auth/saml.routes.ts` — GET /start, POST /callback, GET /metadata/:tenantId
5. Mount saml routes in auth.routes.ts
6. Write tests: saml-utils.test.ts

### Phase 7: Hardening
1. Implement `src/middleware/rateLimiter.ts` — globalLimiter (200/min) + authLimiter (20/15min)
2. Update `src/app.ts` to apply rate limiters (skip in test env)
3. Create `Dockerfile` (multi-stage: build + runtime)
4. Write remaining tests: health.test.ts, validate.test.ts, errors.test.ts
5. Verify: all tests pass, TypeScript compiles with zero errors

---

## 11. Verification Checklist

1. `npm install` — installs all dependencies without errors
2. `npx prisma generate` — generates Prisma client
3. `npx prisma migrate dev --name initial` — creates all tables (requires running PostgreSQL)
4. `npx tsx prisma/seed.ts` — seeds 16 permissions
5. `npx tsc --noEmit` — TypeScript compiles with zero errors
6. `npm test` — all tests pass (27 tests across 6 files)
7. `npm run dev` — starts server, `GET /health` returns `{"status":"ok"}`
8. Manual flow: register user -> login -> get profile -> refresh token -> logout

---

## 12. Extending the Service

### Adding a new OAuth provider (e.g., GitHub)

1. Create `src/modules/auth/strategies/github.strategy.ts` implementing `AuthStrategy`
2. Add `GITHUB` to the `ProviderType` enum in `prisma/schema.prisma`
3. Register the strategy: `registerStrategy(new GitHubStrategy())` in `strategies/index.ts`
4. Add `'github'` to the allowed values in the oauth start route's Zod schema
5. Run `npx prisma migrate dev` to update the enum
6. No other changes needed — the existing OAuth routes, provider CRUD, and login flow handle it automatically

### Adding new permissions

1. Add entries to the `PERMISSIONS` array in `prisma/seed.ts`
2. Run `npx tsx prisma/seed.ts`
3. Assign to roles via `PUT /tenants/:id/roles/:roleId/permissions`

### Adding new API routes

1. Create a new module under `src/modules/`
2. Add appropriate `authorize('resource:action')` middleware
3. Mount in `src/app.ts`
