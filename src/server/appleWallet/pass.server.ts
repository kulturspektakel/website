import {subDays} from 'date-fns';
import {PKPass} from 'passkit-generator';
import template from './CrewCard.pkpasstemplate/pass.json';
import {APPLE_WWDR_G4, CREW_PASS_CERTIFICATE} from './certificates';
import type {WalletPassFields} from '../db/schema';

/**
 * Apple Wallet passes for CrewCards.
 *
 * Every Pass Type ID has its own certificate, so each pass type gets its own
 * entry here; only the certificate's private key is a secret. The same
 * certificate and key sign the passes and authenticate their APNs pushes
 * (push.server.ts). Without the key (e.g. locally) the feature is off:
 * `/crewcard` sends the plain card link and the download route redirects to
 * the card page.
 */
const APPLE_TEAM_ID = 'S279DHCCVB';

export const CREW_PASS = {
  passTypeIdentifier: 'pass.de.kulturspektakel.crew',
  certificate: CREW_PASS_CERTIFICATE,
  privateKey: () => process.env.APPLE_WALLET_CREW_PASS_PRIVATE_KEY,
};

/**
 * The public half of the terminals' NFC (VAS) key pair: base64 X.509
 * SubjectPublicKeyInfo of an ECDH P-256 key. The phone encrypts the NFC message
 * to it; the private half (`pass-nfc.key`, not used by the website) goes on the
 * terminals so they can read wallet cards. Changing it means reissuing passes.
 *
 * The point has to be compressed (`openssl ec -pubout -conv_form compressed`,
 * 33 bytes starting 02/03). Wallet silently rejects passes with the default
 * uncompressed form ("isn't a valid EC compact public key" in the Mac's log).
 */
export const NFC_PUBLIC_KEY =
  'MDkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDIgACT/x60YmnQyx1yd2mal3modLUnXno/Z58GqQv0J/m7mI=';

/**
 * The base URL of the PassKit web service (src/server/appleWalletWebService.ts):
 * Wallet appends `/v1/devices/…`, `/v1/passes/…` and `/v1/log`. Every pass
 * issued carries it, so it has to keep working for as long as they're around.
 * Always production: a pass from a local server registers there too.
 */
export const WALLET_WEB_SERVICE_URL =
  'https://www.kulturspektakel.de/api/crewcard/wallet/apple';

export function isAppleWalletConfigured(): boolean {
  return Boolean(CREW_PASS.privateKey());
}

/**
 * The pass design: CrewCard.pkpasstemplate, edited with Apple's Pass Designer
 * (a Mac app; the template is a folder with pass.json and images). Its fields
 * hold sample values; `crewPassJson` fills in the card's by field `key`, so
 * labels, colors, alignment, formatting and `changeMessage`s all come from the
 * template, and fields the code doesn't know keep their (static) text. Every
 * PNG in the folder goes into the pass; `tooling.json` is the Designer's own.
 */
const templateImages = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('./CrewCard.pkpasstemplate/*.png', {
      eager: true,
      query: '?inline',
      import: 'default',
    }),
    // Vite's `?inline` imports are data URLs.
  ).map(([path, dataUrl]) => [
    path.split('/').pop()!,
    Buffer.from(dataUrl.split(',')[1], 'base64'),
  ]),
);

const FIELD_LISTS = [
  'headerFields',
  'primaryFields',
  'secondaryFields',
  'auxiliaryFields',
  'backFields',
  'footerFields',
] as const;

type PassField = {key: string; label?: string; value: unknown};

// Pass Designer gives every field and action an `_id` for itself.
function withoutDesignerIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutDesignerIds);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== '_id')
        .map(([key, v]) => [key, withoutDesignerIds(v)]),
    );
  }
  return value;
}

export type CrewPassContent = {
  /** The card id as plain hex (`A1B2…`): the pass's serial number. */
  serialNumber: string;
  /** The card id for display (`A1:B2:…`). */
  cardId: string;
  authenticationToken: string;
  payload: string;
  validUntil: Date;
  /** The changing part, from the card's `walletPass` snapshot. */
  fields: WalletPassFields;
};

/** The values the code puts into the template's fields, by `key`. */
function fieldValues({
  cardId,
  validUntil,
  fields,
}: CrewPassContent): Record<string, Omit<PassField, 'key'>> {
  return {
    // The festival (event ids are `kult2027` etc.) and the status.
    status: {
      label: fields.eventId.toUpperCase(),
      value: fields.privileged ? 'BONBUDE' : 'CREW',
    },
    name: {value: fields.holderName},
    // Euros: the template's `currencyCode` formats them.
    bookings: {value: fields.bookingsTotal / 100},
    badges: {value: fields.badges},
    // The last valid day (the card runs out early the next morning), as a
    // date the template's `dateStyle` formats.
    validUntil: {value: subDays(validUntil, 1).toISOString()},
    // Always there, so a message changes an existing field rather than adding
    // one, which may not notify.
    message: {value: fields.message ?? '–'},
    cardId: {value: cardId},
  };
}

/** The pass.json: the template, with the card's values and our settings. */
export function crewPassJson(content: CrewPassContent) {
  const pass = withoutDesignerIds(template) as Record<string, unknown>;

  const values = fieldValues(content);
  const filled = new Set<string>();
  // Every pass style in the template (e.g. `generic`, and `posterGeneric`
  // with `generic` as the fallback for older iOS).
  for (const style of Object.values(pass)) {
    if (!style || typeof style !== 'object' || Array.isArray(style)) {
      continue;
    }
    for (const list of FIELD_LISTS) {
      const passFields = (style as Record<string, unknown>)[list];
      if (!Array.isArray(passFields)) {
        continue;
      }
      for (const field of passFields as PassField[]) {
        if (field.key in values) {
          Object.assign(field, values[field.key]);
          filled.add(field.key);
        }
      }
    }
  }
  const missing = Object.keys(values).filter((key) => !filled.has(key));
  if (missing.length > 0) {
    throw new Error(`CrewCard template is missing fields: ${missing}`);
  }

  const actions = (pass.featuredActions ?? []) as Array<{
    identifier: string;
    url?: string;
  }>;
  const cardPage = actions.find(({identifier}) => identifier === 'card-page');
  if (!cardPage) {
    throw new Error('CrewCard template is missing the card-page action');
  }
  // iOS 27 featured action, shown below the pass (older iOS ignores it).
  cardPage.url = `https://kult.cash/$c/${content.payload}`;

  return {
    ...pass,
    // Tied to the signing certificate.
    passTypeIdentifier: CREW_PASS.passTypeIdentifier,
    teamIdentifier: APPLE_TEAM_ID,
    // The card id: installing the same card twice replaces the pass. Wallet
    // knows the pass by it for good, so it can never change (which rules out
    // the payload: it changes with `validUntil`).
    serialNumber: content.serialNumber,
    // Wallet registers the pass here and fetches updates from here, sending
    // the token as `Authorization: ApplePass <token>`.
    webServiceURL: WALLET_WEB_SERVICE_URL,
    authenticationToken: content.authenticationToken,
    // Hides Wallet's "Share Pass" button. A deterrent: it doesn't stop the
    // .pkpass file itself from being forwarded.
    sharingProhibited: true,
    // Wallet greys the pass out from then on.
    expirationDate: content.validUntil.toISOString(),
    // What the phone hands a terminal over NFC: the same signed payload a
    // physical card carries after `kult.cash/$c/` (23 chars, max is 64).
    nfc: {message: content.payload, encryptionPublicKey: NFC_PUBLIC_KEY},
    featuredActions: actions,
  };
}

export function buildAppleWalletPass(content: CrewPassContent): Buffer {
  const signerKey = CREW_PASS.privateKey();
  if (!signerKey) {
    throw new Error('Apple Wallet is not configured');
  }

  const pass = new PKPass(
    {
      ...templateImages,
      'pass.json': Buffer.from(JSON.stringify(crewPassJson(content))),
    },
    {wwdr: APPLE_WWDR_G4, signerCert: CREW_PASS.certificate, signerKey},
  );
  return pass.getAsBuffer();
}
