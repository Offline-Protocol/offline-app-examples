import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** The theme's ink, for SVG and style props that can't take a class. */
export const INK = '#141414';

/** A hard offset shadow under raised surfaces (buttons, cards). */
export const hardShadow = { boxShadow: `3px 3px 0px ${INK}` } as const;
