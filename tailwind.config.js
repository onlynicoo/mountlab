/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          gold: '#c9920a',
          dark: '#0f0f0f',
        },
      },
    },
  },
  plugins: [],
}

