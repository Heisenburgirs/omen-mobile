import { base58, base64 } from '@scure/base';
import type { SignInProof } from './seeker-proof';

// Deep-link wallets return a detached signature; MWA returns signature + message.
// Normalize both paths to Privy's signed-message format.
export function deeplinkProof(address: string, message: string, signature: string): SignInProof {
  if (base58.decode(address).length !== 32) throw new Error('Invalid wallet address');
  const detached = base58.decode(signature);
  if (detached.length !== 64 || !message) throw new Error('Invalid wallet signature');
  const payload = new TextEncoder().encode(message);
  const signed = new Uint8Array(detached.length + payload.length);
  signed.set(detached);
  signed.set(payload, detached.length);
  return { address, message, signature: base64.encode(signed) };
}
