# Authentication Providers Setup Guide

This guide covers how to configure Google, Microsoft, and SAML authentication for tenants.

## Prerequisites

- Server running (`npm run dev`)
- A tenant created (see [Create a Tenant](#create-a-tenant))
- An admin JWT token for the tenant (see [Get an Admin Token](#get-an-admin-token))

## Create a Tenant

```bash
# You need any valid JWT to create a tenant.
# The creator is automatically assigned the admin role.
curl -s -X POST http://localhost:3000/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Acme Corp",
    "slug": "acme"
  }'
```

Save the returned `id` — this is your `TENANT_ID`.

## Get an Admin Token

Login as an admin user of the tenant:

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password",
    "tenantId": "TENANT_ID"
  }'
```

Use the returned `accessToken` as `ADMIN_TOKEN` in the commands below.

---

## Google OAuth

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console — Credentials](https://console.cloud.google.com/apis/credentials)
2. Create a project or select an existing one
3. Navigate to **APIs & Services > OAuth consent screen**
   - Choose **External** user type
   - Fill in the app name and support email
   - Add scopes: `openid`, `email`, `profile`
   - Add your Google account under **Test users** (required while in testing mode)
4. Navigate to **APIs & Services > Credentials**
5. Click **Create Credentials > OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:3000/auth/oauth/callback`
6. Copy the **Client ID** and **Client Secret**

### 2. Register Provider with Tenant

```bash
ADMIN_TOKEN="<your-admin-token>"
TENANT_ID="<your-tenant-id>"

curl -s -X POST "http://localhost:3000/tenants/$TENANT_ID/providers/oauth" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "type": "GOOGLE",
    "enabled": true,
    "clientId": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "clientSecret": "YOUR_CLIENT_SECRET",
    "scopes": "openid email profile"
  }'
```

### 3. Test the Flow

Open this URL in your browser:

```
http://localhost:3000/auth/oauth/start?provider=google&tenant=TENANT_ID
```

**What happens:**

1. Browser redirects to Google's consent screen
2. You sign in with your Google account
3. Google redirects back to `http://localhost:3000/auth/oauth/callback`
4. The server exchanges the authorization code for tokens
5. A user is created (or linked if the email already exists)
6. The response contains `accessToken` and `refreshToken`

### 4. Update or Disable

```bash
# Get the provider ID
curl -s "http://localhost:3000/tenants/$TENANT_ID/providers" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Update (e.g., rotate client secret)
PROVIDER_ID="<provider-id>"
curl -s -X PATCH "http://localhost:3000/tenants/$TENANT_ID/providers/$PROVIDER_ID/oauth" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "clientSecret": "NEW_CLIENT_SECRET"
  }'

# Disable
curl -s -X PATCH "http://localhost:3000/tenants/$TENANT_ID/providers/$PROVIDER_ID/oauth" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": false}'

# Delete
curl -s -X DELETE "http://localhost:3000/tenants/$TENANT_ID/providers/$PROVIDER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Microsoft OAuth

### 1. Azure Portal Setup

1. Go to [Azure Portal — App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **New registration**
   - Name: your app name
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: **Web** — `http://localhost:3000/auth/oauth/callback`
3. After creation, go to the app's **Overview** page
   - Copy the **Application (client) ID**
4. Go to **Certificates & secrets > New client secret**
   - Copy the **Value** (this is your client secret — it's only shown once)
5. Go to **API permissions**
   - Ensure these are added: `openid`, `email`, `profile`, `User.Read`

### 2. Register Provider with Tenant

```bash
ADMIN_TOKEN="<your-admin-token>"
TENANT_ID="<your-tenant-id>"

curl -s -X POST "http://localhost:3000/tenants/$TENANT_ID/providers/oauth" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "type": "MICROSOFT",
    "enabled": true,
    "clientId": "YOUR_APPLICATION_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET_VALUE",
    "scopes": "openid email profile User.Read"
  }'
```

#### Single-tenant Azure AD (optional)

If you want to restrict login to a specific Azure AD tenant, provide custom URLs:

```bash
AZURE_TENANT_ID="your-azure-tenant-id"

curl -s -X POST "http://localhost:3000/tenants/$TENANT_ID/providers/oauth" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "type": "MICROSOFT",
    "enabled": true,
    "clientId": "YOUR_APPLICATION_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET_VALUE",
    "scopes": "openid email profile User.Read",
    "authUrl": "https://login.microsoftonline.com/'$AZURE_TENANT_ID'/oauth2/v2.0/authorize",
    "tokenUrl": "https://login.microsoftonline.com/'$AZURE_TENANT_ID'/oauth2/v2.0/token"
  }'
```

### 3. Test the Flow

Open this URL in your browser:

```
http://localhost:3000/auth/oauth/start?provider=microsoft&tenant=TENANT_ID
```

The flow is identical to Google — you'll be redirected to Microsoft's login page, then back to the callback URL with tokens.

### 4. Update or Disable

Same commands as Google — use the provider ID from the list endpoint:

```bash
curl -s "http://localhost:3000/tenants/$TENANT_ID/providers" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## SAML SSO

### 1. Identity Provider (IdP) Setup

Configure your IdP (Okta, OneLogin, Azure AD, etc.) with these SP details:

| SP Setting                     | Value                                                      |
| ------------------------------ | ---------------------------------------------------------- |
| Entity ID / Audience           | `http://localhost:3000/auth/saml/metadata/TENANT_ID`       |
| ACS URL (POST binding)        | `http://localhost:3000/auth/saml/callback`                 |
| NameID format                  | `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`   |
| Signature algorithm            | RSA-SHA256                                                 |

You can also provide the SP metadata URL directly to your IdP:

```
http://localhost:3000/auth/saml/metadata/TENANT_ID
```

From your IdP, collect:

- **Entity ID** (IdP Issuer)
- **SSO URL** (IdP Single Sign-On URL, HTTP-Redirect or HTTP-POST binding)
- **X.509 Certificate** (for signature validation)
- Optionally: **IdP Metadata XML** URL

### 2. Register Provider with Tenant

#### Option A: Manual configuration

```bash
ADMIN_TOKEN="<your-admin-token>"
TENANT_ID="<your-tenant-id>"

curl -s -X POST "http://localhost:3000/tenants/$TENANT_ID/providers/saml" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "enabled": true,
    "entityId": "https://idp.example.com/saml/metadata",
    "ssoUrl": "https://idp.example.com/saml/sso",
    "certificate": "MIICmTCCAYECBgF...(base64 cert content)...",
    "signatureAlgorithm": "sha256",
    "digestAlgorithm": "sha256"
  }'
```

#### Option B: Using certificate fingerprint instead of full certificate

```bash
curl -s -X POST "http://localhost:3000/tenants/$TENANT_ID/providers/saml" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "enabled": true,
    "entityId": "https://idp.example.com/saml/metadata",
    "ssoUrl": "https://idp.example.com/saml/sso",
    "certificateFingerprint": "AB:CD:EF:12:34:56:78:90:...",
    "signatureAlgorithm": "sha256"
  }'
```

#### Option C: Providing raw IdP metadata XML

```bash
curl -s -X POST "http://localhost:3000/tenants/$TENANT_ID/providers/saml" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "enabled": true,
    "entityId": "https://idp.example.com/saml/metadata",
    "ssoUrl": "https://idp.example.com/saml/sso",
    "metadataXml": "<md:EntityDescriptor ...>...</md:EntityDescriptor>"
  }'
```

### 3. Test the Flow

Open this URL in your browser:

```
http://localhost:3000/auth/saml/start?tenant=TENANT_ID
```

**What happens:**

1. Browser redirects to your IdP's login page with a SAML AuthnRequest
2. You authenticate with the IdP
3. The IdP POSTs a SAML Response to `http://localhost:3000/auth/saml/callback`
4. The server validates the response and extracts the user's NameID (email)
5. A user is created (or linked if the email already exists)
6. The response contains `accessToken` and `refreshToken`

### 4. Get SP Metadata

Your IdP may need the SP metadata XML. It's available at:

```
GET http://localhost:3000/auth/saml/metadata/TENANT_ID
```

### 5. Update SAML Configuration

```bash
PROVIDER_ID="<provider-id>"

# Update certificate (e.g., during IdP cert rotation)
curl -s -X PATCH "http://localhost:3000/tenants/$TENANT_ID/providers/$PROVIDER_ID/saml" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "certificate": "MIICnew...(new certificate)..."
  }'

# Disable SAML
curl -s -X PATCH "http://localhost:3000/tenants/$TENANT_ID/providers/$PROVIDER_ID/saml" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": false}'

# Delete
curl -s -X DELETE "http://localhost:3000/tenants/$TENANT_ID/providers/$PROVIDER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## IdP-Specific Quick Start Guides

### Okta SAML Setup

1. In Okta Admin, go to **Applications > Create App Integration > SAML 2.0**
2. Set:
   - Single Sign-On URL: `http://localhost:3000/auth/saml/callback`
   - Audience URI: `http://localhost:3000/auth/saml/metadata/TENANT_ID`
   - Name ID format: **EmailAddress**
3. Under **Sign On > SAML Signing Certificates**, download the active certificate
4. From the **Sign On** tab, copy:
   - Identity Provider Issuer → use as `entityId`
   - Identity Provider Single Sign-On URL → use as `ssoUrl`

### Azure AD SAML Setup

1. In Azure Portal, go to **Enterprise Applications > New Application > Create your own**
2. Select **Non-gallery application**
3. Go to **Single sign-on > SAML** and set:
   - Identifier (Entity ID): `http://localhost:3000/auth/saml/metadata/TENANT_ID`
   - Reply URL (ACS): `http://localhost:3000/auth/saml/callback`
4. Download **Certificate (Base64)** from the SAML Signing Certificate section
5. Copy:
   - Azure AD Identifier → use as `entityId`
   - Login URL → use as `ssoUrl`

---

## Managing Providers

### List all providers for a tenant

```bash
curl -s "http://localhost:3000/tenants/$TENANT_ID/providers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
```

### Get a specific provider

```bash
curl -s "http://localhost:3000/tenants/$TENANT_ID/providers/$PROVIDER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool
```

> **Note**: OAuth client secrets are always masked (`••••••••`) in API responses. They are stored encrypted (AES-256-GCM) in the database.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `Google OAuth is not configured for this tenant` | Provider not created or not enabled | Create provider with `enabled: true` |
| `Failed to exchange authorization code` | Invalid client ID/secret or wrong redirect URI | Verify credentials and that redirect URI matches exactly |
| `Invalid state signature` | State parameter tampered or JWT secret mismatch | Retry the flow from `/auth/oauth/start` |
| `State expired or not found` | More than 10 minutes passed since starting the flow | Retry from the start URL |
| `User is not an active member of this tenant` | User exists but membership is INACTIVE | Update membership status via tenant member API |
| `Default member role not found for tenant` | Tenant was created without seed data | Ensure permissions are seeded (`npx tsx prisma/seed.ts`) |
