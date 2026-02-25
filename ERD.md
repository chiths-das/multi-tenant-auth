# Entity Relationship Diagram

## Visual Overview

```
┌──────────────────────┐          ┌──────────────────────┐
│       users          │          │      tenants         │
│──────────────────────│          │──────────────────────│
│ id           PK UUID │          │ id           PK UUID │
│ email        UQ      │          │ name                 │
│ password_hash     ?  │          │ slug         UQ      │
│ display_name         │          │ domain       UQ   ?  │
│ created_at           │          │ created_at           │
│ updated_at           │          │ updated_at           │
└──────┬───┬───────────┘          └──┬───┬───┬──────────┘
       │   │                         │   │   │
       │   │  ┌──────────────────────┘   │   │
       │   │  │                          │   │
       │   │  │  ┌───────────────────────┘   │
       │   │  │  │                           │
       │   │  │  │  ┌────────────────────────┘
       │   │  │  │  │
       │   │  │  │  │    ┌──────────────────────┐
       │   │  │  │  │    │    permissions        │
       │   │  │  │  │    │──────────────────────│
       │   │  │  │  │    │ id         PK UUID   │
       │   │  │  │  │    │ resource             │
       │   │  │  │  │    │ action               │
       │   │  │  │  │    │ UQ(resource, action)  │
       │   │  │  │  │    └──────────┬───────────┘
       │   │  │  │  │               │
       │   │  │  │  │               │ 1:N
       │   │  │  │  │               │
  ┌────┘   │  │  │  │    ┌──────────┴───────────┐
  │        │  │  │  │    │  role_permissions     │
  │        │  │  │  │    │──────────────────────│
  │        │  │  │  │    │ id         PK UUID   │
  │        │  │  │  │    │ role_id    FK        │
  │        │  │  │  │    │ permission_id FK     │
  │        │  │  │  │    │ UQ(role_id, perm_id) │
  │        │  │  │  │    └──────────┬───────────┘
  │        │  │  │  │               │ N:1
  │        │  │  │  │               │
  │  ┌─────┼──┼──┼──┼───────┐      │
  │  │     │  │  │  │       │      │
  │  │     │  │  │  │  ┌────┴──────┴───────────┐
  │  │     │  │  │  │  │       roles            │
  │  │     │  │  │  │  │───────────────────────│
  │  │     │  │  │  │  │ id          PK UUID   │
  │  │     │  │  │  └──│ tenant_id   FK        │
  │  │     │  │  │     │ name                  │
  │  │     │  │  │     │ is_system             │
  │  │     │  │  │     │ UQ(tenant_id, name)   │
  │  │     │  │  │     └────────┬──────────────┘
  │  │     │  │  │              │
  │  │     │  │  │              │ 1:N
  │  │     │  │  │              │
  │  │  ┌──┴──┴──┴──────┐      │
  │  │  │               │      │
  │  │  │  ┌────────────┴──────┴───────┐
  │  │  │  │  tenant_memberships       │
  │  │  │  │──────────────────────────│
  │  │  │  │ id          PK UUID      │
  │  │  │  │ user_id     FK ──────────┼──── users
  │  │  │  │ tenant_id   FK ──────────┼──── tenants
  │  │  │  │ role_id     FK ──────────┼──── roles
  │  │  │  │ status      ENUM         │
  │  │  │  │ joined_at                │
  │  │  │  │ UQ(user_id, tenant_id)   │
  │  │  │  └──────────────────────────┘
  │  │  │
  │  │  │  ┌──────────────────────────┐
  │  │  │  │  linked_accounts         │
  │  │  │  │──────────────────────────│
  │  │  │  │ id              PK UUID  │
  │  │  └──│ user_id         FK       │──── users
  │  │     │ provider_type            │
  │  │     │ provider_user_id         │
  │  │     │ access_token          ?  │
  │  │     │ refresh_token         ?  │
  │  │     │ created_at               │
  │  │     │ updated_at               │
  │  │     │ UQ(provider_type,        │
  │  │     │    provider_user_id)     │
  │  │     └──────────────────────────┘
  │  │
  │  │     ┌─────────────────────────┐
  │  │     │  refresh_tokens         │
  │  │     │─────────────────────────│
  │  │     │ id           PK UUID    │
  │  └─────│ user_id      FK         │──── users
  │        │ tenant_id    FK         │──── tenants
  └────────│                         │
           │ token_hash   UQ         │
           │ family_id    UUID       │
           │ expires_at              │
           │ revoked_at           ?  │
           │ replaced_by  UUID    ?  │
           │ created_at              │
           └─────────────────────────┘


       ┌──────────────────────┐
       │      tenants         │
       └──────────┬───────────┘
                  │
                  │ 1:N
                  │
       ┌──────────┴───────────┐
       │   auth_providers     │
       │──────────────────────│
       │ id          PK UUID  │
       │ tenant_id   FK       │
       │ type        ENUM     │
       │ enabled              │
       │ UQ(tenant_id, type)  │
       └──┬───────────────┬───┘
          │               │
          │ 1:1           │ 1:1
          │               │
┌─────────┴────────┐  ┌──┴──────────────────────┐
│ oauth_provider   │  │ saml_provider           │
│ _configs         │  │ _configs                │
│──────────────────│  │─────────────────────────│
│ id       PK UUID │  │ id             PK UUID  │
│ auth_provider_id │  │ auth_provider_id        │
│            FK UQ │  │                  FK UQ  │
│ tenant_id        │  │ tenant_id               │
│ client_id        │  │ entity_id               │
│ client_secret  * │  │ sso_url                 │
│ scopes           │  │ certificate          ?  │
│ auth_url       ? │  │ certificate_fp       ?  │
│ token_url      ? │  │ signature_algorithm     │
│ user_info_url  ? │  │ digest_algorithm        │
└──────────────────┘  │ metadata_xml         ?  │
                      └─────────────────────────┘

Legend:
  PK = Primary Key       FK = Foreign Key
  UQ = Unique             ? = Nullable
  *  = Encrypted (AES-256-GCM)
```

---

## Tables

### users

Global identity table. A user can belong to multiple tenants.

| Column        | Type         | Constraints          | Description                     |
|---------------|--------------|----------------------|---------------------------------|
| id            | UUID         | PK, auto-generated   | Unique user identifier          |
| email         | VARCHAR      | UNIQUE, NOT NULL     | Login email address             |
| password_hash | VARCHAR      | NULLABLE             | bcrypt hash (cost 12). Null for OAuth/SAML-only users |
| display_name  | VARCHAR      | NOT NULL             | User's display name             |
| created_at    | TIMESTAMPTZ  | NOT NULL, default now| Account creation time           |
| updated_at    | TIMESTAMPTZ  | NOT NULL, auto       | Last update time                |

**RLS**: None (global table, users span tenants)

---

### tenants

Organizations/workspaces. Each tenant has its own roles, providers, and members.

| Column     | Type         | Constraints          | Description                         |
|------------|--------------|----------------------|-------------------------------------|
| id         | UUID         | PK, auto-generated   | Unique tenant identifier            |
| name       | VARCHAR      | NOT NULL             | Display name                        |
| slug       | VARCHAR      | UNIQUE, NOT NULL     | URL-friendly identifier             |
| domain     | VARCHAR      | UNIQUE, NULLABLE     | Email domain for auto-join          |
| created_at | TIMESTAMPTZ  | NOT NULL, default now| Creation time                       |
| updated_at | TIMESTAMPTZ  | NOT NULL, auto       | Last update time                    |

**RLS**: None (looked up by ID/slug directly)

---

### tenant_memberships

Join table connecting users to tenants with a role. A user can be a member of multiple tenants but only once per tenant.

| Column    | Type              | Constraints                   | Description                    |
|-----------|-------------------|-------------------------------|--------------------------------|
| id        | UUID              | PK, auto-generated            | Membership record ID           |
| user_id   | UUID              | FK -> users.id, CASCADE       | The user                       |
| tenant_id | UUID              | FK -> tenants.id, CASCADE     | The tenant                     |
| role_id   | UUID              | FK -> roles.id                | Assigned role in this tenant   |
| status    | MembershipStatus  | NOT NULL, default ACTIVE      | ACTIVE, INACTIVE, or INVITED   |
| joined_at | TIMESTAMPTZ       | NOT NULL, default now         | When the user joined           |

**Unique**: `(user_id, tenant_id)` -- one membership per user per tenant
**RLS**: Filtered by `tenant_id`

---

### linked_accounts

Federated identity links (Google sub, Microsoft oid, SAML NameID). Allows a user to sign in via multiple providers.

| Column           | Type        | Constraints                            | Description                     |
|------------------|-------------|----------------------------------------|---------------------------------|
| id               | UUID        | PK, auto-generated                     | Record ID                       |
| user_id          | UUID        | FK -> users.id, CASCADE                | Owning user                     |
| provider_type    | VARCHAR     | NOT NULL                               | e.g., "google", "microsoft", "saml" |
| provider_user_id | VARCHAR     | NOT NULL                               | Provider's unique user ID       |
| access_token     | VARCHAR     | NULLABLE                               | Provider access token (encrypted) |
| refresh_token    | VARCHAR     | NULLABLE                               | Provider refresh token (encrypted) |
| created_at       | TIMESTAMPTZ | NOT NULL, default now                  | Link creation time              |
| updated_at       | TIMESTAMPTZ | NOT NULL, auto                         | Last update time                |

**Unique**: `(provider_type, provider_user_id)` -- one link per provider identity
**RLS**: None (global, linked to user not tenant)

---

### roles

Per-tenant roles. System roles (admin, member) are created automatically and cannot be deleted.

| Column    | Type    | Constraints                  | Description                    |
|-----------|---------|------------------------------|--------------------------------|
| id        | UUID    | PK, auto-generated           | Role ID                        |
| tenant_id | UUID    | FK -> tenants.id, CASCADE    | Owning tenant                  |
| name      | VARCHAR | NOT NULL                     | Role name (e.g., "admin")      |
| is_system | BOOLEAN | NOT NULL, default false      | Protected from deletion        |

**Unique**: `(tenant_id, name)` -- role names are unique per tenant
**RLS**: Filtered by `tenant_id`

---

### permissions

System-wide resource:action pairs. Shared across all tenants.

| Column   | Type    | Constraints          | Description                      |
|----------|---------|----------------------|----------------------------------|
| id       | UUID    | PK, auto-generated   | Permission ID                    |
| resource | VARCHAR | NOT NULL             | Resource name (e.g., "users")    |
| action   | VARCHAR | NOT NULL             | Action name (e.g., "read")       |

**Unique**: `(resource, action)`
**RLS**: None (global table)

**Seeded permissions**:

| Resource   | Actions                       |
|------------|-------------------------------|
| users      | read, write, delete           |
| tenants    | read, write, delete           |
| members    | read, write, delete           |
| roles      | read, write, delete           |
| providers  | read, write, delete, manage   |

---

### role_permissions

Many-to-many join between roles and permissions.

| Column        | Type | Constraints                      | Description     |
|---------------|------|----------------------------------|-----------------|
| id            | UUID | PK, auto-generated               | Record ID       |
| role_id       | UUID | FK -> roles.id, CASCADE          | The role        |
| permission_id | UUID | FK -> permissions.id, CASCADE    | The permission  |

**Unique**: `(role_id, permission_id)`
**RLS**: Filtered via role's `tenant_id` (subquery on roles table)

---

### auth_providers

Per-tenant authentication provider registration. Each tenant can have at most one of each type.

| Column    | Type         | Constraints                  | Description                         |
|-----------|--------------|------------------------------|-------------------------------------|
| id        | UUID         | PK, auto-generated           | Provider record ID                  |
| tenant_id | UUID         | FK -> tenants.id, CASCADE    | Owning tenant                       |
| type      | ProviderType | NOT NULL                     | GOOGLE, MICROSOFT, or SAML          |
| enabled   | BOOLEAN      | NOT NULL, default false      | Whether this provider is active     |

**Unique**: `(tenant_id, type)` -- one provider per type per tenant
**RLS**: Filtered by `tenant_id`

---

### oauth_provider_configs

OAuth2-specific configuration. One-to-one with auth_providers (for GOOGLE or MICROSOFT type).

| Column           | Type    | Constraints                        | Description                              |
|------------------|---------|------------------------------------|------------------------------------------|
| id               | UUID    | PK, auto-generated                 | Config ID                                |
| auth_provider_id | UUID    | FK -> auth_providers.id, UQ, CASCADE | Parent provider                        |
| tenant_id        | UUID    | NOT NULL                           | Denormalized for RLS                     |
| client_id        | VARCHAR | NOT NULL                           | OAuth client ID                          |
| client_secret    | VARCHAR | NOT NULL                           | OAuth client secret (AES-256-GCM encrypted) |
| scopes           | VARCHAR | NOT NULL, default "openid email profile" | Requested scopes               |
| auth_url         | VARCHAR | NULLABLE                           | Custom authorization endpoint            |
| token_url        | VARCHAR | NULLABLE                           | Custom token endpoint                    |
| user_info_url    | VARCHAR | NULLABLE                           | Custom user info endpoint                |

**RLS**: Filtered by `tenant_id`

---

### saml_provider_configs

SAML-specific configuration. One-to-one with auth_providers (for SAML type).

| Column                  | Type    | Constraints                        | Description                         |
|-------------------------|---------|------------------------------------|-------------------------------------|
| id                      | UUID    | PK, auto-generated                 | Config ID                           |
| auth_provider_id        | UUID    | FK -> auth_providers.id, UQ, CASCADE | Parent provider                   |
| tenant_id               | UUID    | NOT NULL                           | Denormalized for RLS                |
| entity_id               | VARCHAR | NOT NULL                           | IdP Entity ID / Issuer              |
| sso_url                 | VARCHAR | NOT NULL                           | IdP Single Sign-On URL              |
| certificate             | TEXT    | NULLABLE                           | IdP X.509 signing certificate (PEM) |
| certificate_fingerprint | VARCHAR | NULLABLE                           | SHA-256 fingerprint of certificate  |
| signature_algorithm     | VARCHAR | NOT NULL, default "sha256"         | XML signature algorithm             |
| digest_algorithm        | VARCHAR | NOT NULL, default "sha256"         | XML digest algorithm                |
| metadata_xml            | TEXT    | NULLABLE                           | Raw IdP metadata XML                |

**RLS**: Filtered by `tenant_id`

---

### refresh_tokens

Opaque refresh tokens stored as SHA-256 hashes. Supports family-based rotation with reuse detection.

| Column      | Type        | Constraints                  | Description                              |
|-------------|-------------|------------------------------|------------------------------------------|
| id          | UUID        | PK, auto-generated           | Token record ID                          |
| token_hash  | VARCHAR     | UNIQUE, NOT NULL             | SHA-256 hash of the raw token            |
| user_id     | UUID        | FK -> users.id, CASCADE      | Token owner                              |
| tenant_id   | UUID        | FK -> tenants.id, CASCADE    | Tenant context for this session          |
| family_id   | UUID        | NOT NULL                     | Groups tokens in a rotation chain        |
| expires_at  | TIMESTAMPTZ | NOT NULL                     | Expiration (7 days from creation)        |
| revoked_at  | TIMESTAMPTZ | NULLABLE                     | When revoked (null = active)             |
| replaced_by | UUID        | NULLABLE                     | ID of the token that replaced this one   |
| created_at  | TIMESTAMPTZ | NOT NULL, default now        | Creation time                            |

**RLS**: Filtered by `tenant_id`

**Rotation logic**: When a refresh token is used, it is marked as revoked and a new token is created in the same family. If a revoked token is reused (replay attack), the entire family is revoked.

---

## Relationships Summary

| Relationship                          | Type | Description                                    |
|---------------------------------------|------|------------------------------------------------|
| users -> tenant_memberships           | 1:N  | A user can belong to many tenants              |
| tenants -> tenant_memberships         | 1:N  | A tenant has many members                      |
| roles -> tenant_memberships           | 1:N  | A role can be assigned to many members         |
| users -> linked_accounts              | 1:N  | A user can link multiple OAuth/SAML identities |
| users -> refresh_tokens               | 1:N  | A user can have many active sessions           |
| tenants -> refresh_tokens             | 1:N  | Sessions are scoped to a tenant                |
| tenants -> roles                      | 1:N  | Each tenant defines its own roles              |
| tenants -> auth_providers             | 1:N  | Each tenant configures its own providers       |
| roles -> role_permissions             | 1:N  | A role has many permissions                    |
| permissions -> role_permissions       | 1:N  | A permission can be in many roles              |
| auth_providers -> oauth_provider_configs | 1:1 | OAuth config extends a provider              |
| auth_providers -> saml_provider_configs  | 1:1 | SAML config extends a provider               |

---

## Enums

### MembershipStatus
| Value    | Description                          |
|----------|--------------------------------------|
| ACTIVE   | User can authenticate and access     |
| INACTIVE | Membership suspended                 |
| INVITED  | Invitation pending acceptance        |

### ProviderType
| Value     | Description                |
|-----------|----------------------------|
| GOOGLE    | Google OAuth2              |
| MICROSOFT | Microsoft OAuth2           |
| SAML      | SAML 2.0 SSO               |

---

## Row-Level Security (RLS)

Tenant-scoped tables have PostgreSQL RLS policies using `current_setting('app.current_tenant_id')`:

| Table                  | RLS Policy                                                  |
|------------------------|-------------------------------------------------------------|
| tenant_memberships     | `tenant_id = current_setting('app.current_tenant_id')`      |
| roles                  | `tenant_id = current_setting('app.current_tenant_id')`      |
| role_permissions       | `role_id IN (SELECT id FROM roles WHERE tenant_id = ...)`   |
| auth_providers         | `tenant_id = current_setting('app.current_tenant_id')`      |
| oauth_provider_configs | `tenant_id = current_setting('app.current_tenant_id')`      |
| saml_provider_configs  | `tenant_id = current_setting('app.current_tenant_id')`      |
| refresh_tokens         | `tenant_id = current_setting('app.current_tenant_id')`      |

**Global tables** (no RLS): `users`, `permissions`
