import crypto from 'node:crypto';
import { parseStringPromise } from 'xml2js';

/**
 * Compute SHA-256 fingerprint of an X.509 certificate.
 */
export function computeCertFingerprint(certPem: string): string {
  const cleaned = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
  const der = Buffer.from(cleaned, 'base64');
  return crypto.createHash('sha256').update(der).digest('hex').toUpperCase();
}

/**
 * Validate that a certificate matches an expected fingerprint.
 */
export function validateCertFingerprint(certPem: string, expectedFingerprint: string): boolean {
  const actual = computeCertFingerprint(certPem);
  const normalized = expectedFingerprint.replace(/:/g, '').toUpperCase();
  return actual === normalized;
}

/**
 * Generate SP metadata XML for a tenant.
 */
export function generateSpMetadata(
  entityId: string,
  acsUrl: string,
  signingCert?: string,
): string {
  const certBlock = signingCert
    ? `<md:KeyDescriptor use="signing">
        <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
          <ds:X509Data><ds:X509Certificate>${signingCert}</ds:X509Certificate></ds:X509Data>
        </ds:KeyInfo>
      </md:KeyDescriptor>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    ${certBlock}
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}" index="0" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
}

/**
 * Parse IdP metadata XML and extract key fields.
 */
export async function parseIdpMetadata(metadataXml: string): Promise<{
  entityId: string;
  ssoUrl: string;
  certificate?: string;
}> {
  const result = await parseStringPromise(metadataXml, { explicitArray: false });
  const descriptor =
    result['md:EntityDescriptor'] || result['EntityDescriptor'] || result;

  const entityId = descriptor.$.entityID;

  const idpDescriptor =
    descriptor['md:IDPSSODescriptor'] || descriptor['IDPSSODescriptor'];

  const ssoService =
    idpDescriptor?.['md:SingleSignOnService'] ||
    idpDescriptor?.['SingleSignOnService'];

  let ssoUrl: string;
  if (Array.isArray(ssoService)) {
    const httpRedirect = ssoService.find(
      (s: any) => s.$.Binding?.includes('HTTP-Redirect'),
    );
    ssoUrl = (httpRedirect || ssoService[0]).$.Location;
  } else {
    ssoUrl = ssoService?.$.Location;
  }

  // Extract certificate
  let certificate: string | undefined;
  const keyDescriptor =
    idpDescriptor?.['md:KeyDescriptor'] || idpDescriptor?.['KeyDescriptor'];
  if (keyDescriptor) {
    const kd = Array.isArray(keyDescriptor) ? keyDescriptor[0] : keyDescriptor;
    const keyInfo = kd['ds:KeyInfo'] || kd['KeyInfo'];
    const x509Data = keyInfo?.['ds:X509Data'] || keyInfo?.['X509Data'];
    certificate =
      x509Data?.['ds:X509Certificate'] || x509Data?.['X509Certificate'];
  }

  return { entityId, ssoUrl, certificate };
}
