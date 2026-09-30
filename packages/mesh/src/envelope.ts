/**
 * Every message the room sends is one of these, as JSON. `app` carries the
 * app's own payload; the other two are room housekeeping.
 */
export type Envelope =
  | { t: 'app'; d: unknown }
  | { t: 'bye' } // sender is leaving the room
  | { t: 'group'; id: string }; // host -> member: the MLS group of this room

export function encodeEnvelope(envelope: Envelope, maxBytes: number): string {
  const json = JSON.stringify(envelope);
  const bytes = new TextEncoder().encode(json).length;
  if (bytes > maxBytes) {
    throw new Error(`Message is ${bytes} bytes, the room limit is ${maxBytes}. Send less at once.`);
  }
  return json;
}

/** Parses a received message. Returns null for anything that is not a well-formed envelope. */
export function decodeEnvelope(content: string, maxBytes: number): Envelope | null {
  if (typeof content !== 'string' || content.length > maxBytes) return null;
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { t, d, id } = value as Record<string, unknown>;
  if (t === 'app') return { t, d };
  if (t === 'bye') return { t };
  if (t === 'group' && typeof id === 'string' && id.length > 0 && id.length <= 200) return { t, id };
  return null;
}
