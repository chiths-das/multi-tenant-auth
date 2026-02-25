export interface AuthResult {
  userId: string;
  email: string;
  displayName: string;
  providerType: string;
  providerUserId: string;
  isNewUser: boolean;
}

export interface AuthStrategy {
  readonly type: string;

  /**
   * Generate an authorization URL for redirect-based flows (OAuth2/SAML).
   * Returns null for credential-based flows (local).
   */
  getAuthorizationUrl?(tenantId: string, state: string): Promise<string | null>;

  /**
   * Authenticate using provider-specific credentials/callback data.
   */
  authenticate(params: Record<string, unknown>): Promise<AuthResult>;
}
