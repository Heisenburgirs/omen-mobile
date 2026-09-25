#!/usr/bin/env node
// End to end, from Node, with the same client and request shape the app
// uses: open a small USDC channel with Ryvo on mainnet, buy one reply,
// print what it cost, and close the channel so the rest comes back.
//
//   RYVO_BUYER_PRIVATE_KEY=<base58 or JSON array of a funded Solana keypair>
//   RYVO_RPC_URL=<mainnet RPC url>            (a Helius url is fine)
//   RYVO_DEPOSIT_USDC=1                       (optional, default 1)
//   RYVO_MODEL=google/gemini-2.5-flash-lite   (optional)
//   RYVO_KEEP_OPEN=1                          (optional: skip the close)
//   node scripts/ryvo-e2e.mjs
//
// The wallet needs the deposit in USDC and no SOL: Ryvo's facilitator pays
// the fees and rent. Real money moves; keep the deposit small.
import { RyvoChannelClient, MemoryChannelSessionStore } from "@ryvo/channel-client";
import { createKeyPairSignerFromBytes, createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";
import bs58 from "bs58";

const env = (name, fallback) => process.env[name] ?? fallback;
const raw = env("RYVO_BUYER_PRIVATE_KEY");
if (!raw) throw new Error("Set RYVO_BUYER_PRIVATE_KEY");
const rpcUrl = env("RYVO_RPC_URL");
if (!rpcUrl) throw new Error("Set RYVO_RPC_URL");
const bytes = raw.trim().startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : bs58.decode(raw.trim());
const wallet = bytes.length === 64 ? await createKeyPairSignerFromBytes(bytes) : await createKeyPairSignerFromPrivateKeyBytes(bytes);
const deposit = BigInt(Math.round(Number(env("RYVO_DEPOSIT_USDC", "1")) * 1_000_000));
const model = env("RYVO_MODEL", "google/gemini-2.5-flash-lite");

const client = new RyvoChannelClient({
  gatewayUrl: env("RYVO_GATEWAY_URL", "https://inference.ryvo.network"),
  facilitatorUrl: env("RYVO_FACILITATOR_URL", "https://facilitator.ryvo.network"),
  rpcUrl,
  wallet,
  store: new MemoryChannelSessionStore(),
});

const usdc = (micro) => `$${(Number(micro) / 1_000_000).toFixed(6)}`;
console.log("payer", wallet.address);
const profile = await client.profile();
console.log("profile", { min: usdc(profile.minimumDeposit), max: usdc(profile.maximumDeposit), network: profile.network });

console.log("opening channel with", usdc(deposit));
let status = await client.open({ deposit });
console.log("open", { channel: status.channelId, available: usdc(status.available) });

const messages = [
  { role: "system", content: "You are OMEN's agent. Answer in one short sentence." },
  { role: "user", content: "Say hello and name one thing a dividend token does." },
];
const started = Date.now();
const { response, receipt } = await client.paidFetch("/v1/chat/completions", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ model, messages, max_tokens: 400, temperature: 0.4, stream: false }),
});
const body = await response.json();
console.log("reply", response.status, `${Date.now() - started}ms`, body.choices?.[0]?.message?.content);
console.log("charged", receipt ? usdc(receipt.chargedAmount) : "(no receipt)", "max", response.headers.get("x-ryvo-max-charge"));

status = await client.status();
console.log("status", { available: usdc(status.available), spent: usdc(status.accruedSpend), unsettled: usdc(status.unsettled) });

if (env("RYVO_KEEP_OPEN") !== "1") {
  status = await client.close();
  console.log("closed", { state: status.state, closeDeadline: status.closeDeadline });
}
