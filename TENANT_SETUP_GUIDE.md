# Tenant Setup & Authentication Guide

This guide walks through the complete setup of a tenant with all authentication methods, user management across tenants, and how a frontend UI would integrate with the auth service.

---

## Table of Contents

1. [Create a Tenant](#1-create-a-tenant)
2. [Set Up Local Authentication](#2-set-up-local-authentication)
3. [Set Up Google OAuth](#3-set-up-google-oauth)
4. [Set Up Microsoft OAuth](#4-set-up-microsoft-oauth)
5. [Set Up SAML SSO](#5-set-up-saml-sso)
6. [Register Users to a Tenant](#6-register-users-to-a-tenant)
7. [Register Users to Multiple Tenants](#7-register-users-to-multiple-tenants)
8. [Login Flow from a UI](#8-login-flow-from-a-ui)
9. [Session Management](#9-session-management)
10. [Switching Tenants](#10-switching-tenants)

---

## 1. Create a Tenant

A tenant represents an organization or workspace. Every user, role, and provider configuration is scoped to a tenant.

```bash
curl -s -X POST http://localhost:3000/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Acme Corp",
    "slug": "acme",
    "domain": "acme.com"
  }'
```

**Response:**
```json
{
  "id": "8910078d-ed6c-46cb-b237-7543a815a505",
  "name": "Acme Corp",
  "slug": "acme",
  "domain": "acme.com",
  "createdAt": "2026-02-25T06:15:41.113Z",
  "updatedAt": "2026-02-25T06:15:41.113Z"
}
```

The creator is automatically assigned the **admin** role. Two system roles are created:

| Role   | Permissions                                              |
|--------|----------------------------------------------------------|
| admin  | All permissions (users, tenants, members, roles, providers — read, write, delete, manage) |
| member | Read-only (users:read, tenants:read, members:read, roles:read, providers:read)            |

Save the tenant `id` — you'll need it for all subsequent setup.

### Get an Admin Token

Login as the tenant admin to get a token for configuration:

```bash
# If using two-step login
curl -s -X POST http://localhost:3000/auth/login/step1 \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"your-password"}'

# Then select the tenant
curl -s -X POST http://localhost:3000/auth/login/select \
  -H "Content-Type: application/json" \
  -d '{"userId":"<userId>","tenantId":"<tenantId>"}'
```

Use the returned `accessToken` as `$ADMIN_TOKEN` in all admin commands below.

---

## 2. Set Up Local Authentication

Local auth (email + password) works out of the box with no additional configuration. Once a tenant exists, users can register and login immediately.

**Register a user:**
```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@acme.com",
    "password": "securepass123",
    "displayName": "Alice Smith",
    "tenantId": "TENANT_ID"
  }'
```

**Login:**
```bash
# Two-step login (recommended for multi-tenant)
curl -s -X POST http://localhost:3000/auth/login/step1 \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@acme.com","password":"securepass123"}'

# Or direct login if tenant is known
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@acme.com","password":"securepass123","tenantId":"TENANT_ID"}'
```

No provider setup needed — local auth is always available.

---

## 3. Set Up Google OAuth

### 3.1 Google Cloud Console

1. Go to [Google Cloud Console — Credentials](https://console.cloud.google.com/apis/credentials)
2. Create or select a project
3. **OAuth consent screen** setup:
   - User type: **External**
   - App name, support email
   - Scopes: `openid`, `email`, `profile`
   - Add test users (required while in "Testing" status)
4. **Create Credentials > OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:3000/auth/oauth/callback`
5. Copy the **Client ID** and **Client Secret**

### 3.2 Register with Tenant

```bash
curl -s -X POST "http://localhost:3000/tenants/$TENANT_ID/providers/oauth" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "type": "GOOGLE",
    "enabled": true,
    "clientId": "123456789.apps.googleusercontent.com",
    "clientSecret": "GOCSPX-your-secret-here",
    "scopes": "openid email profile"
  }'
```

### 3.3 Test

Open in browser:
```
http://localhost:3000/auth/oauth/start?provider=google&tenant=TENANT_ID
```

Google's consent screen appears. After signing in, the callback returns tokens.

---

## 4. Set Up Microsoft OAuth

### 4.1 Azure Portal

1. Go to [Azure Portal — App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **New registration**:
   - Name: your app name
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: **Web** → `http://localhost:3000/auth/oauth/callback`
3. From the **Overview** page, copy the **Application (client) ID**
4. Go to **Certificates & secrets > New client secret** — copy the **Value**
5. Go to **API permissions** — ensure `openid`, `email`, `profile`, `User.Read` are added

### 4.2 Register with Tenant

```bash
curl -s -X POST "http://localhost:3000/tenants/$TENANT_ID/providers/oauth" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "type": "MICROSOFT",
    "enabled": true,
    "clientId": "your-application-client-id",
    "clientSecret": "your-client-secret-value",
    "scopes": "openid email profile User.Read"
  }'
```

**For single-tenant Azure AD** (restrict to one directory):
```bash
AZURE_TENANT="your-azure-directory-id"

curl -s -X POST "http://localhost:3000/tenants/$TENANT_ID/providers/oauth" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "type": "MICROSOFT",
    "enabled": true,
    "clientId": "your-application-client-id",
    "clientSecret": "your-client-secret-value",
    "scopes": "openid email profile User.Read",
    "authUrl": "https://login.microsoftonline.com/'$AZURE_TENANT'/oauth2/v2.0/authorize",
    "tokenUrl": "https://login.microsoftonline.com/'$AZURE_TENANT'/oauth2/v2.0/token"
  }'
```

### 4.3 Test

Open in browser:
```
http://localhost:3000/auth/oauth/start?provider=microsoft&tenant=TENANT_ID
```

---

## 5. Set Up SAML SSO

### 5.1 Configure Your Identity Provider

Provide your IdP (Okta, Azure AD, OneLogin, etc.) with these Service Provider details:

| SP Setting                     | Value                                                  |
|--------------------------------|--------------------------------------------------------|
| Entity ID / Audience           | `http://localhost:3000/auth/saml/metadata/TENANT_ID`   |
| ACS URL (POST binding)        | `http://localhost:3000/auth/saml/callback`             |
| NameID format                  | `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress` |

Or point the IdP directly to the SP metadata URL:
```
http://localhost:3000/auth/saml/metadata/TENANT_ID
```

From the IdP, collect:
- **Entity ID** (IdP Issuer URL)
- **SSO URL** (Single Sign-On URL)
- **X.509 Certificate** (base64-encoded, for signature validation)

### 5.2 Register with Tenant

```bash
curl -s -X POST "http://localhost:3000/tenants/$TENANT_ID/providers/saml" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "enabled": true,
    "entityId": "https://idp.acme.com/saml/metadata",
    "ssoUrl": "https://idp.acme.com/saml/sso",
    "certificate": "MIICmTCCAYECBgF...(base64 content)...",
    "signatureAlgorithm": "sha256",
    "digestAlgorithm": "sha256"
  }'
```

### 5.3 Okta Quick Setup

1. **Applications > Create App Integration > SAML 2.0**
2. Single Sign-On URL: `http://localhost:3000/auth/saml/callback`
3. Audience URI: `http://localhost:3000/auth/saml/metadata/TENANT_ID`
4. Name ID format: **EmailAddress**
5. From the **Sign On** tab, copy **Identity Provider Issuer** and **SSO URL**
6. Download the signing certificate

### 5.4 Azure AD Quick Setup

1. **Enterprise Applications > New > Create your own (Non-gallery)**
2. **Single sign-on > SAML**:
   - Identifier: `http://localhost:3000/auth/saml/metadata/TENANT_ID`
   - Reply URL: `http://localhost:3000/auth/saml/callback`
3. Download the **Certificate (Base64)**
4. Copy **Azure AD Identifier** (entityId) and **Login URL** (ssoUrl)

### 5.5 Test

Open in browser:
```
http://localhost:3000/auth/saml/start?tenant=TENANT_ID
```

---

## 6. Register Users to a Tenant

There are three ways a user becomes a member of a tenant:

### 6.1 Self-Registration

A new user signs up and joins a tenant in one step:

```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bob@gmail.com",
    "password": "securepass123",
    "displayName": "Bob Jones",
    "tenantId": "TENANT_ID"
  }'
```

The user is created and assigned the **member** role automatically.

### 6.2 Admin Invitation

A tenant admin adds an existing user to the tenant:

```bash
# First, you need the user's ID and a role ID
# Get available roles
curl -s "http://localhost:3000/tenants/$TENANT_ID/roles" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Add the user as a member
curl -s -X POST "http://localhost:3000/tenants/$TENANT_ID/members" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "userId": "USER_ID",
    "roleId": "ROLE_ID"
  }'
```

### 6.3 OAuth / SAML Auto-Join

When a user signs in via Google, Microsoft, or SAML for a specific tenant and they don't have a membership yet, one is created automatically with the **member** role.

---

## 7. Register Users to Multiple Tenants

A single user (identified by email) can belong to many tenants. Each membership has its own role and permissions.

### Scenario: Alice joins two organizations

**Step 1 — Alice registers with Acme Corp:**
```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@gmail.com",
    "password": "securepass123",
    "displayName": "Alice Smith",
    "tenantId": "ACME_TENANT_ID"
  }'
```

**Step 2 — Globex admin invites Alice:**
```bash
# Globex admin adds Alice to their tenant
curl -s -X POST "http://localhost:3000/tenants/$GLOBEX_TENANT_ID/members" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GLOBEX_ADMIN_TOKEN" \
  -d '{
    "userId": "ALICE_USER_ID",
    "roleId": "GLOBEX_MEMBER_ROLE_ID"
  }'
```

**Or — Alice self-registers with Globex:**
```bash
# Existing users can register with another tenant
# (password is ignored since user already exists)
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@gmail.com",
    "password": "securepass123",
    "displayName": "Alice Smith",
    "tenantId": "GLOBEX_TENANT_ID"
  }'
```

**Result — Alice now has two memberships:**
```
alice@gmail.com
├── Acme Corp    (role: member)
└── Globex Inc   (role: member)
```

### Assign Different Roles Per Tenant

Alice can be an admin in one tenant and a member in another:

```bash
# Promote Alice to admin in Acme
curl -s -X PATCH "http://localhost:3000/tenants/$ACME_TENANT_ID/members/$ALICE_USER_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACME_ADMIN_TOKEN" \
  -d '{"roleId": "ACME_ADMIN_ROLE_ID"}'
```

```
alice@gmail.com
├── Acme Corp    (role: admin)   ← full permissions
└── Globex Inc   (role: member)  ← read-only
```

---

## 8. Login Flow from a UI

This section describes how a frontend application integrates with the auth service. The flow handles local login, OAuth, SAML, single-tenant users, and multi-tenant users.

### 8.1 Login Page Design

```
┌─────────────────────────────────────────────────┐
│                                                 │
│                 Sign In                         │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  Email                                  │    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │  Password                               │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │            Sign In                      │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ─────────── or continue with ──────────────    │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Google  │  │Microsoft │  │   SSO    │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                 │
│  Don't have an account? Sign up                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 8.2 Local Login Flow (Two-Step)

```
┌──────────┐          ┌──────────┐          ┌──────────┐
│  Login   │          │  Tenant  │          │Dashboard │
│  Page    │          │  Picker  │          │          │
└────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │
     │  User enters        │                     │
     │  email + password   │                     │
     │  clicks "Sign In"   │                     │
     │                     │                     │
     │  POST /auth/login/step1                   │
     │  {email, password}  │                     │
     │─────────────────────────────────────>      │
     │                     │                     │
     │  Response:          │                     │
     │  {userId, tenants}  │                     │
     │<─────────────────────────────────────      │
     │                     │                     │
     │                     │                     │
     ├─── tenants.length === 1 ─────────────────>│
     │    (auto-select,                          │
     │     skip picker)    │                     │
     │                     │                     │
     │    POST /auth/login/select                │
     │    {userId, tenantId}                     │
     │───────────────────────────────────────>    │
     │                     │                     │
     │    {accessToken,    │                     │
     │     refreshToken}   │                     │
     │<───────────────────────────────────────   │
     │                     │                     │
     │                     │  Store tokens       │
     │                     │  Redirect to        │
     │                     │  dashboard          │
     │                     │─────────────────>   │
     │                     │                     │
     ├─── tenants.length > 1 ──>│                │
     │    (show picker)    │                     │
     │                     │                     │
     │                     │  User selects       │
     │                     │  a tenant           │
     │                     │                     │
     │                     │  POST /auth/        │
     │                     │  login/select       │
     │                     │  {userId, tenantId} │
     │                     │─────────────────────>
     │                     │                     │
     │                     │  {accessToken,      │
     │                     │   refreshToken}     │
     │                     │<─────────────────────
     │                     │                     │
     │                     │  Store tokens       │
     │                     │  Redirect           │
     │                     │─────────────────>   │
```

#### Frontend Code (React Example)

```typescript
// Step 1: Authenticate
async function handleLogin(email: string, password: string) {
  const response = await fetch('/auth/login/step1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();

  if (data.tenants.length === 1) {
    // Single tenant — skip picker, go directly to step 2
    await selectTenant(data.userId, data.tenants[0].id);
  } else {
    // Multiple tenants — show picker
    showTenantPicker(data.userId, data.tenants);
  }
}

// Step 2: Select tenant and get tokens
async function selectTenant(userId: string, tenantId: string) {
  const response = await fetch('/auth/login/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, tenantId }),
  });
  const tokens = await response.json();

  // Store tokens
  localStorage.setItem('accessToken', tokens.accessToken);
  localStorage.setItem('refreshToken', tokens.refreshToken);

  // Redirect to dashboard
  window.location.href = '/dashboard';
}
```

#### Tenant Picker UI

```
┌─────────────────────────────────────────────────┐
│                                                 │
│         Select an Organization                  │
│                                                 │
│  Welcome back, Alice!                           │
│  Choose which organization to sign into:        │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  🏢  Acme Corp                          │    │
│  │      Role: Admin                        │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  🏢  Globex Inc                         │    │
│  │      Role: Member                       │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  🏢  Initech                            │    │
│  │      Role: Member (Invited)             │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 8.3 Google / Microsoft OAuth Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Login   │     │  Google  │     │  Server  │     │Dashboard │
│  Page    │     │  Consent │     │ Callback │     │          │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │  User clicks   │                │                │
     │  "Google" btn   │                │                │
     │                │                │                │
     │  Browser navigates to:          │                │
     │  /auth/oauth/start?             │                │
     │  provider=google&               │                │
     │  tenant=TENANT_ID               │                │
     │─────────────────────────────>   │                │
     │                │                │                │
     │                │  Server generates               │
     │                │  HMAC-signed state,             │
     │                │  302 redirects to               │
     │                │  Google                         │
     │                │                │                │
     │  ┌─────────────┤                │                │
     │  │ Google      │                │                │
     │  │ consent     │                │                │
     │  │ screen      │                │                │
     │  │             │                │                │
     │  │ User clicks │                │                │
     │  │ "Allow"     │                │                │
     │  └──────┬──────┘                │                │
     │         │                       │                │
     │         │  Google redirects to: │                │
     │         │  /auth/oauth/callback?│                │
     │         │  code=AUTH_CODE&      │                │
     │         │  state=SIGNED_STATE   │                │
     │         │──────────────────────>│                │
     │         │                       │                │
     │         │                       │  Validate state│
     │         │                       │  Exchange code │
     │         │                       │  Fetch user    │
     │         │                       │  info          │
     │         │                       │  Create/link   │
     │         │                       │  user          │
     │         │                       │  Issue tokens  │
     │         │                       │                │
     │         │                       │  {accessToken, │
     │         │                       │   refreshToken}│
     │         │                       │────────────────>
     │         │                       │                │
     │         │                       │  Store tokens  │
     │         │                       │  Redirect to   │
     │         │                       │  dashboard     │
```

#### Frontend Code

```typescript
function handleGoogleLogin(tenantId: string) {
  // For OAuth, the tenant must be known beforehand
  // (from subdomain, URL path, or user selection)
  window.location.href =
    `/auth/oauth/start?provider=google&tenant=${tenantId}`;
}

function handleMicrosoftLogin(tenantId: string) {
  window.location.href =
    `/auth/oauth/start?provider=microsoft&tenant=${tenantId}`;
}
```

**Important**: OAuth and SAML flows require a `tenant` parameter upfront because:
- The server needs to load tenant-specific client credentials from the database
- Different tenants may use different Google/Microsoft apps
- The callback issues tokens scoped to that tenant

The UI should resolve the tenant before initiating OAuth — see [Section 8.5](#85-resolving-the-tenant-for-oauthsaml).

### 8.4 SAML SSO Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Login   │     │   IdP    │     │  Server  │     │Dashboard │
│  Page    │     │  Login   │     │ Callback │     │          │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │  User clicks   │                │                │
     │  "SSO" button   │                │                │
     │                │                │                │
     │  (UI prompts for                │                │
     │   corp email or │                │                │
     │   tenant slug)  │                │                │
     │                │                │                │
     │  Browser navigates to:          │                │
     │  /auth/saml/start?              │                │
     │  tenant=TENANT_ID               │                │
     │─────────────────────────────>   │                │
     │                │                │                │
     │                │  Server builds │                │
     │                │  AuthnRequest, │                │
     │                │  302 redirects │                │
     │                │  to IdP        │                │
     │                │                │                │
     │  ┌─────────────┤                │                │
     │  │ IdP login   │                │                │
     │  │ page        │                │                │
     │  │ (Okta,      │                │                │
     │  │  Azure AD,  │                │                │
     │  │  etc.)      │                │                │
     │  │             │                │                │
     │  │ User enters │                │                │
     │  │ corporate   │                │                │
     │  │ credentials │                │                │
     │  └──────┬──────┘                │                │
     │         │                       │                │
     │         │  IdP sends POST to:   │                │
     │         │  /auth/saml/callback   │                │
     │         │  {SAMLResponse,       │                │
     │         │   RelayState}         │                │
     │         │──────────────────────>│                │
     │         │                       │                │
     │         │                       │  Validate      │
     │         │                       │  response      │
     │         │                       │  Extract email  │
     │         │                       │  Create/link   │
     │         │                       │  user          │
     │         │                       │  Issue tokens  │
     │         │                       │                │
     │         │                       │  {accessToken, │
     │         │                       │   refreshToken}│
     │         │                       │────────────────>
```

#### Frontend Code

```typescript
function handleSsoLogin() {
  // Option 1: Tenant known from subdomain/URL
  const tenantId = getCurrentTenantId();
  window.location.href = `/auth/saml/start?tenant=${tenantId}`;
}

// Option 2: Ask user for their corporate email domain
async function handleSsoWithEmailLookup(email: string) {
  // Your UI resolves the tenant from the email domain
  // e.g., "alice@acme.com" → tenant with domain "acme.com"
  const domain = email.split('@')[1];
  const tenantId = await resolveTenantByDomain(domain);
  window.location.href = `/auth/saml/start?tenant=${tenantId}`;
}
```

### 8.5 Resolving the Tenant for OAuth/SAML

Since OAuth and SAML need the tenant ID before starting the flow, the UI must determine it. Common patterns:

| Method | Example | How It Works |
|--------|---------|-------------|
| **Subdomain** | `acme.yourapp.com` | UI extracts `acme` from hostname, looks up tenant by slug |
| **URL path** | `yourapp.com/org/acme` | UI extracts `acme` from URL path |
| **Email domain** | User enters `alice@acme.com` | UI resolves `acme.com` → tenant with matching `domain` field |
| **Tenant selector** | Dropdown or input field | UI shows a "Company" field before the OAuth/SAML buttons |
| **Dedicated SSO page** | `yourapp.com/sso` | Separate page asks for company email, resolves tenant, then redirects |

**Recommended for most apps**: Use subdomain or URL path. The login page at `acme.yourapp.com/login` already knows the tenant context, so all buttons (Google, Microsoft, SSO) work without extra input.

### 8.6 Complete Login Page Logic (Pseudocode)

```typescript
// Determine tenant context (if available)
const tenantSlug = window.location.hostname.split('.')[0]; // e.g., "acme"
const tenantId = tenantSlug !== 'app' ? await lookupTenantBySlug(tenantSlug) : null;

// ── Local Login (works with or without tenant context) ──
async function onLocalLogin(email: string, password: string) {
  // Step 1: Authenticate
  const { userId, tenants } = await api.post('/auth/login/step1', { email, password });

  if (tenantId) {
    // Tenant already known from URL — select it directly
    const tokens = await api.post('/auth/login/select', { userId, tenantId });
    storeTokens(tokens);
    redirect('/dashboard');
  } else if (tenants.length === 1) {
    // Only one tenant — auto-select
    const tokens = await api.post('/auth/login/select', { userId, tenantId: tenants[0].id });
    storeTokens(tokens);
    redirect('/dashboard');
  } else {
    // Multiple tenants — show picker
    showTenantPicker(userId, tenants);
  }
}

// ── OAuth Login (requires tenant context) ──
function onGoogleLogin() {
  if (!tenantId) {
    showError('Please enter your company email first or use the login form');
    return;
  }
  window.location.href = `/auth/oauth/start?provider=google&tenant=${tenantId}`;
}

function onMicrosoftLogin() {
  if (!tenantId) {
    showError('Please enter your company email first or use the login form');
    return;
  }
  window.location.href = `/auth/oauth/start?provider=microsoft&tenant=${tenantId}`;
}

// ── SAML SSO ──
function onSsoLogin() {
  if (!tenantId) {
    // Ask user for their email to resolve tenant
    showEmailInput((email) => {
      const domain = email.split('@')[1];
      resolveTenantByDomain(domain).then((tid) => {
        window.location.href = `/auth/saml/start?tenant=${tid}`;
      });
    });
    return;
  }
  window.location.href = `/auth/saml/start?tenant=${tenantId}`;
}

// ── Tenant Picker Callback ──
async function onTenantSelected(userId: string, tenantId: string) {
  const tokens = await api.post('/auth/login/select', { userId, tenantId });
  storeTokens(tokens);
  redirect('/dashboard');
}
```

---

## 9. Session Management

### 9.1 Token Storage

```typescript
// After login, store both tokens
function storeTokens(tokens: { accessToken: string; refreshToken: string }) {
  // Access token — short-lived, used for API calls
  localStorage.setItem('accessToken', tokens.accessToken);

  // Refresh token — long-lived, used to get new access tokens
  localStorage.setItem('refreshToken', tokens.refreshToken);
}
```

### 9.2 Making Authenticated API Calls

```typescript
async function apiCall(url: string, options: RequestInit = {}) {
  const accessToken = localStorage.getItem('accessToken');

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    // Access token expired — try refreshing
    const refreshed = await refreshTokens();
    if (refreshed) {
      // Retry the original request with new token
      return apiCall(url, options);
    } else {
      // Refresh failed — redirect to login
      redirectToLogin();
    }
  }

  return response;
}
```

### 9.3 Token Refresh

```typescript
async function refreshTokens(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const response = await fetch('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const tokens = await response.json();
    storeTokens(tokens);
    return true;
  } catch {
    return false;
  }
}
```

### 9.4 Logout

```typescript
async function logout() {
  const refreshToken = localStorage.getItem('refreshToken');

  if (refreshToken) {
    await fetch('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  }

  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  redirectToLogin();
}
```

### 9.5 Token Lifecycle

```
Login
  │
  ▼
┌─────────────────┐     ┌─────────────────┐
│  Access Token   │     │  Refresh Token  │
│  (15 minutes)   │     │  (7 days)       │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │  Token expires        │
         │  (401 response)       │
         │                       │
         │  POST /auth/refresh ──┘
         │  with refresh token
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  New Access     │     │  New Refresh    │
│  Token          │     │  Token          │
│  (15 minutes)   │     │  (7 days)       │
└─────────────────┘     └─────────────────┘
                              │
                   Old refresh token
                   is now REVOKED.
                   Using it again triggers
                   reuse detection →
                   entire family revoked →
                   user must re-login.
```

---

## 10. Switching Tenants

If a user belongs to multiple tenants, they can switch without re-entering credentials.

### From the UI

```
┌─────────────────────────────────────────────────┐
│  Dashboard                    ┌───────────────┐ │
│                               │ Acme Corp   ▼ │ │
│                               ├───────────────┤ │
│                               │ ✓ Acme Corp   │ │
│                               │   Globex Inc  │ │
│                               │   Initech     │ │
│                               └───────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Implementation

```typescript
async function switchTenant(newTenantId: string) {
  // Option 1: Use existing step1 result if cached
  // Option 2: Re-authenticate silently
  const userId = getCurrentUserId(); // from JWT payload

  const response = await fetch('/auth/login/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, tenantId: newTenantId }),
  });

  const tokens = await response.json();
  storeTokens(tokens);

  // Reload the page to reflect new tenant context
  window.location.reload();
}
```

**What changes when switching tenants:**
- New access token with different `tid`, `role`, and `permissions`
- New refresh token (separate session per tenant)
- UI may show different features based on the new permissions array in the JWT

**What stays the same:**
- User identity (`sub` in JWT)
- User profile (email, display name)

### Reading Tenant Info from the JWT

The access token contains everything the UI needs to render tenant-specific features:

```typescript
// Decode JWT payload (no verification needed on client — server already verified)
function parseJwt(token: string) {
  const payload = token.split('.')[1];
  return JSON.parse(atob(payload));
}

const jwt = parseJwt(accessToken);
// jwt.sub         → "user-uuid"
// jwt.tid         → "tenant-uuid"
// jwt.role        → "admin"
// jwt.permissions → ["users:read", "users:write", "providers:manage", ...]

// Conditionally render UI elements
const canManageProviders = jwt.permissions.includes('providers:manage');
const canManageMembers = jwt.permissions.includes('members:write');
const canManageRoles = jwt.permissions.includes('roles:write');
```
