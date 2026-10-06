/** Seeded tickets for Flow B demos (no partner trademark in copy). */
export type SeededTicket = {
  ticketId: string;
  holder: string;
  section: string;
  tier: string;
};

export const DEMO_EVENT = {
  eventId: 'evt-demo-2026',
  name: 'Harbor Pavilion — Night Session',
} as const;

export const SEEDED_TICKETS: SeededTicket[] = [
  { ticketId: 'T-1001', holder: 'Alex Kim', section: 'A', tier: 'GA' },
  { ticketId: 'T-1002', holder: 'Jordan Lee', section: 'B', tier: 'GA' },
  { ticketId: 'T-1003', holder: 'Sam Rivera', section: 'VIP', tier: 'VIP' },
  { ticketId: 'T-1004', holder: 'Casey Morgan', section: 'A', tier: 'GA' },
  { ticketId: 'T-1005', holder: 'Riley Chen', section: 'C', tier: 'GA' },
];

export function findTicket(ticketId: string): SeededTicket | undefined {
  const id = ticketId.trim().toUpperCase();
  return SEEDED_TICKETS.find((t) => t.ticketId === id);
}
