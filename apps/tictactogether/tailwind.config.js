/** @type {import('tailwindcss').Config} */
module.exports = {
  // Include the shared ui package so its component classes are generated.
  content: ['./App.tsx', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  presets: [require('@offline-app-examples/ui/tailwind-preset')],
};
