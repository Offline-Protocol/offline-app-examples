export type MenuItem = { id: string; name: string; price: number };

export const MENU: MenuItem[] = [
  { id: 'burger', name: 'Burger', price: 12 },
  { id: 'pizza', name: 'Pizza slice', price: 6 },
  { id: 'fries', name: 'Fries', price: 4 },
  { id: 'salad', name: 'Green salad', price: 9 },
  { id: 'ramen', name: 'Ramen', price: 14 },
  { id: 'taco', name: 'Taco', price: 5 },
  { id: 'soda', name: 'Soda', price: 3 },
  { id: 'icecream', name: 'Ice cream', price: 5 },
];

export const TABLES = 12;

export function menuItem(id: string): MenuItem | undefined {
  return MENU.find((item) => item.id === id);
}
