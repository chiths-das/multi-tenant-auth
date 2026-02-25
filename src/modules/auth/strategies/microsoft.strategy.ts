import { getPrisma } from '../../../config/database.js';
import { getEnv } from '../../../config/env.js';
import { decrypt } from '../../../lib/crypto.js';
import { NotFoundError, UnauthorizedError } from '../../../lib/errors.js';
import type { AuthStrategy, AuthResult } from './auth-strategy.js';

const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MS_USERINFO_URL = 'https://graph.microsoft.com/v1.0/me';

export class MicrosoftStrategy implements AuthStrategy {
  readonly type = 'microsoft';

  async getAuthorizationUrl(tenantId: string, state: string): Promise<string> {
    const config = await this.getConfig(tenantId);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: `${getEnv().BASE_URL}/auth/oauth/callback`,
      response_type: 'code',
      scope: config.scopes,
      state,
      response_mode: 'query',
    });
    const authUrl = config.authUrl || MS_AUTH_URL;
    return `${authUrl}?${params.toString()}`;
  }

  async authenticate(params: Record<string, unknown>): Promise<AuthResult> {
    const { code, tenantId } = params as { code: string; tenantId: string };
    const config = await this.getConfig(tenantId);
    const clientSecret = decrypt(config.clientSecret);

    const tokenResponse = await fetch(config.tokenUrl || MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: clientSecret,
        redirect_uri: `${getEnv().BASE_URL}/auth/oauth/callback`,
        grant_type: 'authorization_code',
        scope: config.scopes,
      }),
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedError('Failed to exchange authorization code');
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
    };

    const userInfoResponse = await fetch(config.userInfoUrl || MS_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw new UnauthorizedError('Failed to fetch user info from Microsoft');
    }

    const userInfo = (await userInfoResponse.json()) as {
      id: string;
      mail?: string;
      userPrincipalName: string;
      displayName: string;
    };

    return {
      userId: '',
      email: userInfo.mail || userInfo.userPrincipalName,
      displayName: userInfo.displayName,
      providerType: 'microsoft',
      providerUserId: userInfo.id,
      isNewUser: false,
    };
  }

  private async getConfig(tenantId: string) {
    const prisma = getPrisma();
    const provider = await prisma.authProvider.findUnique({
      where: { tenantId_type: { tenantId, type: 'MICROSOFT' } },
      include: { oauthProviderConfig: true },
    });

    if (!provider?.enabled || !provider.oauthProviderConfig) {
      throw new NotFoundError('Microsoft OAuth is not configured for this tenant');
    }

    return provider.oauthProviderConfig;
  }
}
