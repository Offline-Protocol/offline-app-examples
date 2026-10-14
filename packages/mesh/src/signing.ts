/** An Ed25519 signature and the identity key that made it, hex-encoded so it fits in JSON. */
export type Signed = { publicKey: string; signature: string };

export const utf8 = (text: string): number[] => Array.from(new TextEncoder().encode(text));

export const toHex = (bytes: number[]): string =>
  bytes.map(b => b.toString(16).padStart(2, '0')).join('');

/** Null unless `hex` is an even-length lowercase or uppercase hex string. */
export function fromHex(hex: unknown): number[] | null {
  if (typeof hex !== 'string' || hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) return null;
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));
  return bytes;
}
