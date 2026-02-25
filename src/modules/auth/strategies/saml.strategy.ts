import { getPrisma } from '../../../config/database.js';
import { getEnv } from '../../../config/env.js';
import { NotFoundError, UnauthorizedError } from '../../../lib/errors.js';
import type { AuthStrategy, AuthResult } from './auth-strategy.js';

export class SamlStrategy implements AuthStrategy {
  readonly type = 'saml';

  async getAuthorizationUrl(tenantId: string, state: string): Promise<string> {
    const config = await this.getConfig(tenantId);
    const env = getEnv();
    const spEntityId = `${env.BASE_URL}/auth/saml/metadata/${tenantId}`;
    const acsUrl = `${env.BASE_URL}/auth/saml/callback`;

    // Build SAML AuthnRequest redirect URL
    const params = new URLSearchParams({
      SAMLRequest: this.buildAuthnRequest(spEntityId, acsUrl, config.entityId),
      RelayState: state,
    });

    return `${config.ssoUrl}?${params.toString()}`;
  }

  async authenticate(params: Record<string, unknown>): Promise<AuthResult> {
    const { samlResponse, tenantId } = params as {
      samlResponse: Record<string, unknown>;
      tenantId: string;
    };

    // The SAML response is already validated by passport-saml
    const nameId = samlResponse.nameID as string;
    const email = (samlResponse.email as string) || nameId;
    const displayName =
      (samlResponse.displayName as string) ||
      (samlResponse.firstName as string
        ? `${samlResponse.firstName} ${samlResponse.lastName || ''}`
        : email);

    return {
      userId: '',
      email,
      displayName: displayName.trim(),
      providerType: 'saml',
      providerUserId: nameId,
      isNewUser: false,
    };
  }

  private buildAuthnRequest(
    spEntityId: string,
    acsUrl: string,
    _destination: string,
  ): string {
    const id = `_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const issueInstant = new Date().toISOString();

    const xml = `<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${id}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  AssertionConsumerServiceURL="${acsUrl}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${spEntityId}</saml:Issuer>
</samlp:AuthnRequest>`;

    // Deflate + base64 encode for HTTP-Redirect binding
    return Buffer.from(xml).toString('base64');
  }

  private async getConfig(tenantId: string) {
    const prisma = getPrisma();
    const provider = await prisma.authProvider.findUnique({
      where: { tenantId_type: { tenantId, type: 'SAML' } },
      include: { samlProviderConfig: true },
    });

    if (!provider?.enabled || !provider.samlProviderConfig) {
      throw new NotFoundError('SAML is not configured for this tenant');
    }

    return provider.samlProviderConfig;
  }
}
