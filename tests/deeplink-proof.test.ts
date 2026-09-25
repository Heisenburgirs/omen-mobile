import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { base58, base64 } from '@scure/base';
import { deeplinkProof } from '../src/lib/deeplink-proof';
const address = base58.encode(new Uint8Array(32).fill(7));
const signature = new Uint8Array(64).fill(9);
test('deep-link proof retains the exact Privy challenge and detached signature', () => {
  const message = 'getomen.xyz: Sign in — nonce: exact-value';
  const result = deeplinkProof(address, message, base58.encode(signature));
  const bytes = base64.decode(result.signature);
  assert.equal(result.address, address);
  assert.equal(result.message, message);
  assert.deepEqual(bytes.slice(0, 64), signature);
  assert.equal(new TextDecoder().decode(bytes.slice(64)), message);
});
test('reject malformed wallet addresses, signatures and empty challenges', () => {
  assert.throws(() => deeplinkProof('invalid', 'message', base58.encode(signature)));
  assert.throws(() => deeplinkProof(address, 'message', base58.encode(signature.slice(1))));
  assert.throws(() => deeplinkProof(address, '', base58.encode(signature)));
});
