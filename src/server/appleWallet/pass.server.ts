import {subDays} from 'date-fns';
import {PKPass} from 'passkit-generator';
import icon from './icon.png?inline';
import icon2x from './icon@2x.png?inline';
import icon3x from './icon@3x.png?inline';
import logo from './logo.png?inline';
import logo2x from './logo@2x.png?inline';
import logo3x from './logo@3x.png?inline';
import {APPLE_WWDR_G4, CREW_PASS_CERTIFICATE} from './certificates';

/**
 * Apple Wallet passes for CrewCards.
 *
 * Every Pass Type ID has its own certificate, so each pass type gets its own
 * entry here; only the certificate's private key is a secret. Without it (e.g.
 * locally) the feature is off: `/crewcard` sends the plain card link and the
 * download route redirects to the card page.
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

// The festival a card is for: it's valid until the day after it ends.
function festivalYear(validUntil: Date): number {
  return subDays(validUntil, 1).getFullYear();
}

// Vite's `?inline` imports are data URLs.
const png = (dataUrl: string) => Buffer.from(dataUrl.split(',')[1], 'base64');

export type CrewPassContent = {
  /** The card id as plain hex (`A1B2…`): the pass's serial number. */
  serialNumber: string;
  /** The card id for display (`A1:B2:…`). */
  cardId: string;
  authenticationToken: string;
  payload: string;
  holderName: string;
  lastValidDay: string;
  validUntil: Date;
  privileged: boolean;
};

export function crewPassJson({
  serialNumber,
  cardId,
  authenticationToken,
  holderName,
  lastValidDay,
  validUntil,
  privileged,
  payload,
}: CrewPassContent) {
  return {
    formatVersion: 1,
    passTypeIdentifier: CREW_PASS.passTypeIdentifier,
    teamIdentifier: APPLE_TEAM_ID,
    // The card id: installing the same card twice replaces the pass. Wallet
    // knows the pass by it for good, so it can never change (which rules out
    // the payload: it changes with `validUntil`).
    serialNumber,
    // Wallet registers the pass here and fetches updates from here, sending
    // the token as `Authorization: ApplePass <token>`.
    webServiceURL: WALLET_WEB_SERVICE_URL,
    authenticationToken,
    organizationName: 'Kulturspektakel Gauting',
    description: 'CrewCard',
    // The KultCard's red and its white K square (src/components/kultcard/Card.tsx;
    // source: logo.svg here, rendered with rsvg-convert, 30 pt). "CREW" in the
    // header's top-right corner sets it apart from a KultCard.
    backgroundColor: 'rgb(228, 19, 57)',
    foregroundColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(255, 255, 255)',
    // Hides Wallet's "Share Pass" button. A deterrent: it doesn't stop the
    // .pkpass file itself from being forwarded.
    sharingProhibited: true,
    // Wallet greys the pass out from then on.
    expirationDate: validUntil.toISOString(),
    // What the phone hands a terminal over NFC: the same signed payload a
    // physical card carries after `kult.cash/$c/` (23 chars, max is 64).
    nfc: {message: payload, encryptionPublicKey: NFC_PUBLIC_KEY},
    // iOS 27 featured action, shown below the pass (older iOS ignores it).
    // Apple has no generic "open link" type and sets the label and icon by
    // type; `membershipBenefits` ("Membership benefits") is the closest fit for
    // the card page with its bookings and badges.
    featuredActions: [
      {
        identifier: 'card-page',
        type: 'membershipBenefits',
        url: `https://kult.cash/$c/${payload}`,
      },
    ],
    // Only text on Wallet's own background: a store card's strip image puts
    // the name over the artwork (long names get cut off) and Wallet's tinted
    // background shows the strip's edges; a generic thumbnail gets a white
    // photo frame.
    generic: {
      // The label line is reserved even when empty, so it carries the
      // festival: label + value together sit centered on the logo.
      headerFields: [
        {key: 'crew', label: `KULT${festivalYear(validUntil)}`, value: 'CREW'},
      ],
      primaryFields: [{key: 'name', label: 'Name', value: holderName}],
      secondaryFields: [
        // Like the card page: "Bonbude" for the privileged, else crew.
        {
          key: 'status',
          label: 'Status',
          value: privileged ? 'Bonbude' : 'Crew',
        },
        {key: 'validUntil', label: 'Gültig bis', value: lastValidDay},
      ],
      backFields: [{key: 'cardId', label: 'Karten-ID', value: cardId}],
    },
  };
}

export function buildAppleWalletPass(content: CrewPassContent): Buffer {
  const signerKey = CREW_PASS.privateKey();
  if (!signerKey) {
    throw new Error('Apple Wallet is not configured');
  }

  const pass = new PKPass(
    {
      'pass.json': Buffer.from(JSON.stringify(crewPassJson(content))),
      'icon.png': png(icon),
      'icon@2x.png': png(icon2x),
      'icon@3x.png': png(icon3x),
      'logo.png': png(logo),
      'logo@2x.png': png(logo2x),
      'logo@3x.png': png(logo3x),
    },
    {wwdr: APPLE_WWDR_G4, signerCert: CREW_PASS.certificate, signerKey},
  );
  return pass.getAsBuffer();
}
