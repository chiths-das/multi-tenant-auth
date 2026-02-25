import type { AuthStrategy } from './auth-strategy.js';
import { LocalStrategy } from './local.strategy.js';
import { GoogleStrategy } from './google.strategy.js';
import { MicrosoftStrategy } from './microsoft.strategy.js';
import { SamlStrategy } from './saml.strategy.js';

const strategyRegistry = new Map<string, AuthStrategy>();

export function registerStrategy(strategy: AuthStrategy): void {
  strategyRegistry.set(strategy.type, strategy);
}

export function getStrategy(type: string): AuthStrategy {
  const strategy = strategyRegistry.get(type);
  if (!strategy) {
    throw new Error(`Unknown auth strategy: ${type}`);
  }
  return strategy;
}

// Register built-in strategies
registerStrategy(new LocalStrategy());
registerStrategy(new GoogleStrategy());
registerStrategy(new MicrosoftStrategy());
registerStrategy(new SamlStrategy());

export { LocalStrategy } from './local.strategy.js';
export { GoogleStrategy } from './google.strategy.js';
export { MicrosoftStrategy } from './microsoft.strategy.js';
export { SamlStrategy } from './saml.strategy.js';
export type { AuthStrategy, AuthResult } from './auth-strategy.js';
