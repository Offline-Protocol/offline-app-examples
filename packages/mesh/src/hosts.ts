/** A nearby device advertising a room for this app. */
export type NearbyHost = { id: string; name: string; seenAt: number };

/** The subset of the SDK's `service_discovered` event this file reads. */
export type ServiceAnnouncement = {
  service_id: string;
  version: string;
  provider_peer_id: string;
  capabilities: Record<string, string>;
};

export const SERVICE_VERSION = '1';
const MAX_NAME_LENGTH = 30;

export function cleanName(name: unknown, fallback: string): string {
  const trimmed = typeof name === 'string' ? name.trim().slice(0, MAX_NAME_LENGTH) : '';
  return trimmed || fallback;
}

/** Turns an announcement into a host, or null when it is not a room of this app. */
export function hostFromAnnouncement(
  event: ServiceAnnouncement,
  serviceId: string,
  localId: string,
  now: number,
): NearbyHost | null {
  const id = event.provider_peer_id;
  if (
    event.service_id !== serviceId ||
    event.version !== SERVICE_VERSION ||
    id === localId ||
    !id.startsWith('off1') // SDK addresses; anything else is not a real peer
  ) {
    return null;
  }
  return { id, name: cleanName(event.capabilities?.name, 'Nearby host'), seenAt: now };
}

/** Adds or refreshes a host, keeping first-seen order so rows do not jump around. */
export function upsertHost(hosts: NearbyHost[], host: NearbyHost): NearbyHost[] {
  const index = hosts.findIndex(h => h.id === host.id);
  if (index === -1) return [...hosts, host];
  const next = hosts.slice();
  next[index] = host;
  return next;
}

/** Drops hosts that have not answered a discovery query recently. */
export function pruneHosts(hosts: NearbyHost[], now: number, maxAgeMs: number): NearbyHost[] {
  const fresh = hosts.filter(h => now - h.seenAt < maxAgeMs);
  return fresh.length === hosts.length ? hosts : fresh;
}
