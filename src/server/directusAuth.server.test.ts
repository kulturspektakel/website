import {describe, test, expect, beforeAll} from 'vitest';
import {createHmac} from 'node:crypto';
import {verifyDirectusSession} from './directusAuth.server';

const SECRET = 'test-directus-secret';

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
});

const b64 = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj)).toString('base64url');

/** Mint an HS256 token, signing with `secret` and a configurable header. */
function mint(
  payload: Record<string, unknown>,
  {secret = SECRET, alg = 'HS256'} = {},
) {
  const head = b64({alg, typ: 'JWT'});
  const body = b64(payload);
  const sig = createHmac('sha256', secret)
    .update(`${head}.${body}`)
    .digest('base64url');
  return `${head}.${body}.${sig}`;
}

const future = Math.floor(Date.now() / 1000) + 3600;
const past = Math.floor(Date.now() / 1000) - 3600;

describe('verifyDirectusSession', () => {
  test('accepts a validly-signed, unexpired token', () => {
    const session = verifyDirectusSession(mint({id: 'u1', exp: future}));
    expect(session?.id).toBe('u1');
  });

  test('rejects an expired token', () => {
    expect(verifyDirectusSession(mint({id: 'u1', exp: past}))).toBeUndefined();
  });

  test('rejects a token signed with the wrong secret', () => {
    const token = mint({id: 'u1', exp: future}, {secret: 'wrong-secret'});
    expect(verifyDirectusSession(token)).toBeUndefined();
  });

  test('rejects a non-HS256 algorithm (alg confusion)', () => {
    const token = mint({id: 'u1', exp: future}, {alg: 'none'});
    expect(verifyDirectusSession(token)).toBeUndefined();
  });

  test('rejects missing or malformed tokens', () => {
    expect(verifyDirectusSession(undefined)).toBeUndefined();
    expect(verifyDirectusSession('not-a-jwt')).toBeUndefined();
  });
});
