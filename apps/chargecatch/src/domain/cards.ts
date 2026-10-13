export const DEMO_SITE = {
  siteId: 'site-demo-north',
  name: 'North Depot — demo charge site',
} as const;

export const CHARGER_IDS = ['CP-A', 'CP-B'] as const;
export type ChargerId = (typeof CHARGER_IDS)[number];

export type DemoCard = {
  cardId: string;
  label: string;
};

export const SEEDED_CARDS: DemoCard[] = [
  { cardId: 'RFID-1001', label: 'Fleet van 12' },
  { cardId: 'RFID-1002', label: 'Member pass — Alex' },
  { cardId: 'RFID-1003', label: 'Fleet van 07' },
];

export function findCard(cardId: string): DemoCard | undefined {
  const id = cardId.trim().toUpperCase();
  return SEEDED_CARDS.find((c) => c.cardId === id);
}
