// Awareness team phone number — shown on the public /awareness page (tel: +
// WhatsApp buttons) and used as the destination for the Twilio escalation call.
// It's public, so it lives here as a constant rather than a secret.
//
// Single source in E.164; the wa.me format is derived (digits only, no "+").
export const AWARENESS_PHONE = '+4915567585422';
export const AWARENESS_PHONE_WHATSAPP = AWARENESS_PHONE.replace(/\D/g, '');
