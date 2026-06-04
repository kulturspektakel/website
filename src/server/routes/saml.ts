import {IdentityProvider, ServiceProvider, setSchemaValidator} from 'samlify';
import {addMinutes, isPast} from 'date-fns';
import {prismaClient} from '../../utils/prismaClient.server';

/**
 * Migrated from `~/api.kulturspektakel.de/src/routes/saml/index.ts`.
 *
 * SAML 2.0 Identity Provider for single sign-on into the Nuclino wiki
 * (kult.wiki). Two ways to authenticate:
 *   - `GET /saml/login?nonce=…` — completes login from a one-time nonce that
 *     was minted after Slack approval (see `_main.nuclino-sso.tsx`).
 *   - `POST /saml/login` (form field `password`) — shared-password fallback
 *     for Crew members without a Slack account.
 * `GET /saml/logout` handles SP-initiated logout.
 *
 * The IdP entityID / SSO URL is the public URL of `/saml/login` and must match
 * what is configured on the Nuclino side. When this moved off
 * `api.kulturspektakel.de` the entityID changed to this site's domain
 * (`SITE_URL`), so the Nuclino SSO configuration was updated to point here.
 */
const SSO_URL = `${process.env.SITE_URL}/saml/login`;
const SLO_URL = `${process.env.SITE_URL}/saml/logout`;

// Public signing certificate. Originally read from `artifacts/saml.crt`; inlined
// here because Vercel's serverless bundle can't reliably read loose files at
// runtime. The matching private key lives in `SAML_PRIVATE_KEY`.
const SIGNING_CERT = `-----BEGIN CERTIFICATE-----
MIIFlDCCA3wCCQC2YQBbNfopVDANBgkqhkiG9w0BAQsFADCBizELMAkGA1UEBhMC
REUxEDAOBgNVBAcMB0dhdXRpbmcxJTAjBgNVBAoMHEt1bHR1cnNwZWt0YWtlbCBH
YXV0aW5nIGUuVi4xGzAZBgNVBAMMEmRlLmt1bHR1cnNwZWt0YWtlbDEmMCQGCSqG
SIb3DQEJARYXaW5mb0BrdWx0dXJzcGVrdGFrZWwuZGUwHhcNMjIwMzIzMjI1NjMw
WhcNMzIwMzIwMjI1NjMwWjCBizELMAkGA1UEBhMCREUxEDAOBgNVBAcMB0dhdXRp
bmcxJTAjBgNVBAoMHEt1bHR1cnNwZWt0YWtlbCBHYXV0aW5nIGUuVi4xGzAZBgNV
BAMMEmRlLmt1bHR1cnNwZWt0YWtlbDEmMCQGCSqGSIb3DQEJARYXaW5mb0BrdWx0
dXJzcGVrdGFrZWwuZGUwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDX
rn+3DOP1jQtBchOegUqlK6FDBTJXayWh18gPKpgH/tiZ85IKEW0dyPqdW4uBgp+u
KqbrcEpwSKLlKVPrKszrS58MRa5YTa3TxStrKIXIS0yI6WwEyx8ypDI6QhoE0wyh
KoKrImajljp0KliYcwYBSvJs3KpG9L9HKUrQZ0Wz4724qINf/9mfLyNt14pHxhe+
Q/7iuLhkp/vSql9DM5CLV1kikk1h/eENxU/Wbnz2hGjjwHQiAKnLd4yX82eaL9Ss
UAtukwZiSW6zZ+XZkxGw7pMncPvk11yf791lT9sdMH4sYEmj4uMn1C/MzRU7mBuE
MtC8YGx5tF4Jcrpj0ryrrZrCIjdQb4erN5uPhpn8ztmtSINmvJ/FnoQxfAmaEECw
5AafmBsYJYDdArofwUd/0RPgnLEnMXKmqbevlIdWx9SCwRbt/iREIWpSi6YagLzr
0x8CNSFlNZBmsd8p5bVmzx5qQzQmo6pGLSeTl1QK9871PXTd2nWx4iM4oijFNB2d
doHHrk9UAKnwkb5yH4izsCjs1zBq0QH/BMOkV2wHpJoHGlZiHdIX54pcP+MuqAfV
11+GKtKJudK8JJUJMRTPpy41e0geWz+V5OTqXMmRxm+MdPCvmdhq+m8/ZpVrajpB
SIxTBb0Wz+MoEyB/7yvyxhth0ytnt5XVqF0PtoFBGQIDAQABMA0GCSqGSIb3DQEB
CwUAA4ICAQDD3kYD5BBWWdSR7T+YHiGICz4pPJb/BILuaJWpfnyvIAeyGcNi1EU/
elWd0UK8Fa6z/2YDt8Y/xna3SNJryaqTHm7fPUHZ/qbYV2iA+7LCWmKsqzvnltU6
672BNLWL6n81W9T1wiNFQzOyuQlumo2ga0K+4WI7lNMA271etSIpNtJdsn7u97RA
EItI5eBXw24HPUcSFVgB9DX/gtP5bQ5SlbIvix2DiIPTeNu5BLFXJ7oue8d/xPvA
/ktCf4AKjZ0S4505tFOs3Bl86r2WGXj8oOyV69IRpow6nY/bUz9gpQBY7kTXG+76
iKK5rqFYlIjdX7mej0vSYJBJTN4OGmWsl7157Y4nG+cX9rcUUsxRqP2q43F+pFDF
EA1Pm9UzCGIKYo9Sz02B9XyK+mxaOuuZgGzHhxeSqIuTFMJljovv0svJumQu+CIO
U5vo87XcJMR81S7JOoNu5TSxC9Tl+oZPqEycyYKm+2P7Eo7+ze6qFnL/rQyOBJTZ
q6uYwczbcZ3aMjMgrJHgm3RgH6i2sXwq/d39iIp0MrVZamr20T4WC22ft60EFQiU
JQo1RJ3no6zJGXOt0EnGe0brMUNsRUudtB3kVinwiMqC0s+c4tu2my6FY8X+f3BA
dtmHRfngXduuy8WGKpHvMk4QlxiBCbbZBU5n+RxHANCTtAuzAylFiQ==
-----END CERTIFICATE-----`;

const replaceTagsByValue = (
  rawXML: string,
  tagValues: Record<string, string>,
): string => {
  Object.keys(tagValues).forEach((t) => {
    rawXML = rawXML.replace(new RegExp(`{${t}}`, 'g'), tagValues[t]);
  });
  return rawXML;
};

// Escapes a value for safe interpolation into a double-quoted HTML attribute.
const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const sp = ServiceProvider({
  entityID: `https://api.nuclino.com/api/sso/${process.env.NUCLINO_TEAM_ID}/metadata`,
  assertionConsumerService: [
    {
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
      Location: `https://api.nuclino.com/api/sso/${process.env.NUCLINO_TEAM_ID}/acs`,
    },
  ],
});

setSchemaValidator({
  validate: (_response: string) => {
    // TODO: check if makes sense
    return Promise.resolve('skipped');
  },
});

const idp = IdentityProvider({
  entityID: SSO_URL,
  privateKey: process.env.SAML_PRIVATE_KEY,
  signingCert: SIGNING_CERT,
  isAssertionEncrypted: false,
  singleSignOnService: [
    {
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Post',
      Location: SSO_URL,
    },
  ],
  singleLogoutService: [
    {
      Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
      Location: SLO_URL,
    },
  ],
  nameIDFormat: ['urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'],
  loginResponseTemplate: {
    context:
      '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="{ID}" Version="2.0" IssueInstant="{IssueInstant}" Destination="{Destination}" InResponseTo="{InResponseTo}"><saml:Issuer>{Issuer}</saml:Issuer><samlp:Status><samlp:StatusCode Value="{StatusCode}"/></samlp:Status><saml:Assertion ID="{AssertionID}" Version="2.0" IssueInstant="{IssueInstant}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Issuer>{Issuer}</saml:Issuer><saml:Subject><saml:NameID Format="{NameIDFormat}">{NameID}</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="{SubjectConfirmationDataNotOnOrAfter}" Recipient="{SubjectRecipient}" InResponseTo="{InResponseTo}"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="{ConditionsNotBefore}" NotOnOrAfter="{ConditionsNotOnOrAfter}"><saml:AudienceRestriction><saml:Audience>{Audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions>{AttributeStatement}</saml:Assertion></samlp:Response>',
    attributes: [
      {
        name: 'FirstName',
        valueTag: 'firstName',
        nameFormat: 'urn:oasis:names:tc:SAML:2.0:attrname-format:basic',
        valueXsiType: 'xs:string',
      },
      {
        name: 'LastName',
        valueTag: 'lastName',
        nameFormat: 'urn:oasis:names:tc:SAML:2.0:attrname-format:basic',
        valueXsiType: 'xs:string',
      },
    ],
  },
});

// samlify's `parseLoginRequest`/`parseLogoutRequest` expect Hono-style
// `{query, body}` accessors. Adapt a web `Request` to that shape.
async function samlRequest(request: Request) {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const body: Record<string, string> = {};
  if (request.method === 'POST') {
    // The login form posts application/x-www-form-urlencoded. Parse the raw body
    // with URLSearchParams rather than request.formData() so body parsing doesn't
    // depend on the server adapter's formData() implementation.
    for (const [key, value] of new URLSearchParams(await request.text())) {
      body[key] = value;
    }
  }
  return {query, body};
}

export async function handleSamlLogin(request: Request): Promise<Response> {
  const {query, body} = await samlRequest(request);

  let viewer: {displayName: string; email: string} | undefined;
  if (request.method === 'POST') {
    // Shared-password fallback.
    if (
      !body.password ||
      body.password !== process.env.NUCLINO_ANONYMOUS_PASSWORD
    ) {
      return Response.redirect('https://kult.wiki', 302);
    }
    viewer = {email: 'info@kulturspektakel.de', displayName: 'Anonymer User'};
  } else {
    // Nonce-based login.
    viewer = await viewerFromNonce(query.nonce);
    if (!query.nonce || !viewer) {
      return Response.redirect('https://kult.wiki', 302);
    }
  }

  return await sendSAMLResponse({query, body}, viewer);
}

export async function handleSamlLogout(request: Request): Promise<Response> {
  const {query, body} = await samlRequest(request);

  const parseResult = await idp.parseLogoutRequest(sp, 'redirect', {
    body,
    query,
  });

  const response = idp.createLogoutResponse(
    sp,
    parseResult as any,
    'redirect',
    '',
  );
  return new Response(response.context);
}

async function sendSAMLResponse(
  req: {query: Record<string, string>; body: Record<string, string>},
  viewer: {displayName: string; email: string},
): Promise<Response> {
  const [firstName, ...lastNames] = viewer.displayName.split(' ');

  const parseResult = await idp.parseLoginRequest(sp, 'redirect', req);

  const {id, assertionConsumerServiceUrl, issueInstant, destination} =
    parseResult.extract.request as {
      id: string;
      assertionConsumerServiceUrl: string;
      issueInstant: string;
      destination: string;
    };

  const response = await idp.createLoginResponse(
    sp,
    parseResult as any,
    'post',
    {},
    (samlResponse) => {
      const fiveMinutesLater = addMinutes(new Date(issueInstant), 5);

      return {
        id,
        context: replaceTagsByValue(samlResponse, {
          ID: id,
          AssertionID: idp.entitySetting.generateID!(),
          Destination: destination,
          Audience: sp.entityMeta.getEntityID(),
          SubjectRecipient: destination,
          NameIDFormat: idp.entityMeta.getNameIDFormat()[0],
          Issuer: idp.entityMeta.getEntityID(),
          IssueInstant: issueInstant,
          ConditionsNotBefore: issueInstant,
          ConditionsNotOnOrAfter: fiveMinutesLater.toISOString(),
          SubjectConfirmationDataNotOnOrAfter: fiveMinutesLater.toISOString(),
          AssertionConsumerServiceURL: assertionConsumerServiceUrl,
          EntityID: sp.entityMeta.getEntityID(),
          InResponseTo: id,
          StatusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success',
          NameID: viewer.email,
          attrFirstName: firstName,
          attrLastName: lastNames.join(' '),
        }),
      };
    },
  );

  const relayState = req.query.RelayState ?? '';

  // Auto-submitting form that POSTs the SAML response back to Nuclino's ACS.
  const formHtml = `<form method="post" action="${escapeAttr(
    assertionConsumerServiceUrl,
  )}">
  <input type="hidden" name="SAMLResponse" value="${escapeAttr(
    response.context,
  )}" />
  <input type="hidden" name="RelayState" value="${escapeAttr(relayState)}" />
  <script type="text/javascript">
    (function () {
      document.forms[0].submit();
    })();
  </script>
</form>`;

  return new Response(formHtml, {
    headers: {'content-type': 'text/html; charset=utf-8'},
  });
}

async function viewerFromNonce(nonce?: string) {
  if (!nonce) {
    return;
  }
  try {
    const {createdFor, expiresAt} = await prismaClient.nonce.delete({
      where: {nonce},
      select: {
        createdFor: true,
        expiresAt: true,
      },
    });
    if (createdFor && !isPast(expiresAt)) {
      return createdFor;
    }
  } catch (e) {
    // Prisma throws P2025 when the nonce doesn't exist (already consumed or
    // expired). That's the expected "invalid login" path, so swallow it and
    // let the caller redirect away.
  }
}
