import {PKPass} from 'passkit-generator';
import icon from './icon.png?inline';
import icon2x from './icon@2x.png?inline';
import icon3x from './icon@3x.png?inline';
import logo from './logo.png?inline';
import logo2x from './logo@2x.png?inline';
import logo3x from './logo@3x.png?inline';
import strip from './strip.png?inline';
import strip2x from './strip@2x.png?inline';
import strip3x from './strip@3x.png?inline';
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

const CREW_PASS = {
  passTypeIdentifier: 'pass.de.kulturspektakel.crew',
  certificate: CREW_PASS_CERTIFICATE,
  privateKey: () => process.env.APPLE_WALLET_CREW_PASS_PRIVATE_KEY,
};

/**
 * The public half of the terminals' NFC (VAS) key pair: base64 X.509
 * SubjectPublicKeyInfo of an ECDH P-256 key. The phone encrypts the NFC message
 * to it; the private half (`pass-nfc.key`, not used by the website) goes on the
 * terminals so they can read wallet cards. Changing it means reissuing passes.
 */
const NFC_PUBLIC_KEY =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAET/x60YmnQyx1yd2mal3modLUnXno/Z58GqQv0J/m7mKeK6F/nrHwXFTWgzSEV0pJj9MRgikHJZPEJ0GV3cIUwA==';

export function isAppleWalletConfigured(): boolean {
  return Boolean(CREW_PASS.privateKey());
}

// Vite's `?inline` imports are data URLs.
const png = (dataUrl: string) => Buffer.from(dataUrl.split(',')[1], 'base64');

export function buildAppleWalletPass({
  cardId,
  holderName,
  lastValidDay,
  validUntil,
  payload,
}: {
  payload: string;
  cardId: string;
  holderName: string;
  lastValidDay: string;
  validUntil: Date;
}): Buffer {
  const signerKey = CREW_PASS.privateKey();
  if (!signerKey) {
    throw new Error('Apple Wallet is not configured');
  }

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: CREW_PASS.passTypeIdentifier,
    teamIdentifier: APPLE_TEAM_ID,
    // The card id: installing the same card twice replaces the pass.
    serialNumber: cardId,
    organizationName: 'Kulturspektakel Gauting',
    description: 'CrewCard',
    // The KultCard look (src/components/kultcard/Card.tsx): its red, the white
    // logo, and its circles and contactless symbol in the strip image (sources:
    // logo.svg / strip.svg here, rendered with rsvg-convert). "CREW" next to
    // the logo sets it apart from a KultCard.
    backgroundColor: 'rgb(228, 19, 57)',
    foregroundColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(255, 255, 255)',
    logoText: 'CREW',
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
    // storeCard rather than generic: generic passes can't show a strip image;
    // a store card shows it with the primary field (the name) on top.
    storeCard: {
      primaryFields: [{key: 'name', label: 'Name', value: holderName}],
      secondaryFields: [
        {key: 'validUntil', label: 'Gültig bis', value: lastValidDay},
      ],
      backFields: [{key: 'cardId', label: 'Karten-ID', value: cardId}],
    },
  };

  const pass = new PKPass(
    {
      'pass.json': Buffer.from(JSON.stringify(passJson)),
      'icon.png': png(icon),
      'icon@2x.png': png(icon2x),
      'icon@3x.png': png(icon3x),
      'logo.png': png(logo),
      'logo@2x.png': png(logo2x),
      'logo@3x.png': png(logo3x),
      'strip.png': png(strip),
      'strip@2x.png': png(strip2x),
      'strip@3x.png': png(strip3x),
    },
    {wwdr: APPLE_WWDR_G4, signerCert: CREW_PASS.certificate, signerKey},
  );
  return pass.getAsBuffer();
}
