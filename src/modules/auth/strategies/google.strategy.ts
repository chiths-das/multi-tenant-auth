import { getPrisma } from '../../../config/database.js';
import { getEnv } from '../../../config/env.js';
import { decrypt, hmacSign } from '../../../lib/crypto.js';
import { NotFoundError, UnauthorizedError } from '../../../lib/errors.js';
import type { AuthStrategy, AuthResult } from './auth-strategy.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export class GoogleStrategy implements AuthStrategy {
  readonly type = 'google';

  async getAuthorizationUrl(tenantId: string, state: string): Promise<string> {
    const config = await this.getConfig(tenantId);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: `${getEnv().BASE_URL}/auth/oauth/callback`,
      response_type: 'code',
      scope: config.scopes,
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    const authUrl = config.authUrl || GOOGLE_AUTH_URL;
    return `${authUrl}?${params.toString()}`;
  }

  async authenticate(params: Record<string, unknown>): Promise<AuthResult> {
    const { code, tenantId } = params as { code: string; tenantId: string };
    const config = await this.getConfig(tenantId);
    const clientSecret = decrypt(config.clientSecret);

    // Exchange code for tokens
    const tokenResponse = await fetch(config.tokenUrl || GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: clientSecret,
        redirect_uri: `${getEnv().BASE_URL}/auth/oauth/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedError('Failed to exchange authorization code');
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
    };

    // Get user info
    const userInfoResponse = await fetch(config.userInfoUrl || GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw new UnauthorizedError('Failed to fetch user info from Google');
    }

    const userInfo = (await userInfoResponse.json()) as {
      sub: string;
      email: string;
      name: string;
    };

    return {
      userId: '',
      email: userInfo.email,
      displayName: userInfo.name,
      providerType: 'google',
      providerUserId: userInfo.sub,
      isNewUser: false,
    };
  }

  private async getConfig(tenantId: string) {
    const prisma = getPrisma();
    const provider = await prisma.authProvider.findUnique({
      where: { tenantId_type: { tenantId, type: 'GOOGLE' } },
      include: { oauthProviderConfig: true },
    });

    if (!provider?.enabled || !provider.oauthProviderConfig) {
      throw new NotFoundError('Google OAuth is not configured for this tenant');
    }

    return provider.oauthProviderConfig;
  }
}
