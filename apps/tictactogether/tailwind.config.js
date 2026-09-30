/** @type {import('tailwindcss').Config} */
module.exports = {
  // Include the shared ui package so its component classes are generated.
  content: ['./App.tsx', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  presets: [require('@offline-app-examples/ui/tailwind-preset')],
  theme: {
    extend: {
      // The game's own palette, on top of the shared theme.
      colors: {
        paper: '#FBF8F2', // page background
        sand: '#EFEBE4', // board, cards, pills
        coral: '#F07869', // X
        plum: '#8B78D5', // O
        lavender: '#EDE7FA', // O tint, whose turn it is
      },
    },
  },
};
