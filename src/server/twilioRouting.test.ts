import {afterEach, describe, expect, test} from 'vitest';
import {parseDialNumbers, screenTwiml} from './twilioRouting';
import {twilioSignature} from './twilioAuth.server';

describe('screenTwiml', () => {
  test('asks for one digit and posts back to the accept callback', () => {
    const xml = screenTwiml('CA123', 'https://kult.example');
    expect(xml).toContain('numDigits="1"');
    expect(xml).toContain(
      'action="https://kult.example/api/twilio/accept?conf=CA123"',
    );
  });
});

describe('parseDialNumbers', () => {
  const original = process.env.TWILIO_DIAL_NUMBERS;
  afterEach(() => {
    process.env.TWILIO_DIAL_NUMBERS = original;
  });

  test('splits and trims the comma-separated list', () => {
    process.env.TWILIO_DIAL_NUMBERS = ' +491111 , +492222 ,';
    expect(parseDialNumbers()).toEqual(['+491111', '+492222']);
  });

  test('throws when unset', () => {
    delete process.env.TWILIO_DIAL_NUMBERS;
    expect(() => parseDialNumbers()).toThrow();
  });
});

describe('twilioSignature', () => {
  // Canonical example from Twilio's request-validation docs.
  test('matches the documented reference signature', () => {
    const params = new URLSearchParams({
      CallSid: 'CA1234567890ABCDE',
      Caller: '+14158675310',
      Digits: '1234',
      From: '+14158675310',
      To: '+18005551212',
    });
    const signature = twilioSignature(
      'https://example.com/myapp.php?foo=1&bar=2',
      params,
      '12345',
    );
    expect(signature).toBe('L/OH5YylLD5NRKLltdqwSvS0BnU=');
  });
});
