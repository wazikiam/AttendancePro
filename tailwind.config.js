/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'oklch(0.97 0.01 255)',
          100: 'oklch(0.95 0.02 255)',
          200: 'oklch(0.90 0.04 255)',
          300: 'oklch(0.85 0.06 255)',
          400: 'oklch(0.75 0.08 255)',
          500: 'oklch(0.65 0.15 255)',
          600: 'oklch(0.55 0.20 255)',
          700: 'oklch(0.45 0.25 255)',
          800: 'oklch(0.35 0.30 255)',
          900: 'oklch(0.25 0.35 255)',
        },
        neutral: {
          50: 'oklch(0.99 0.00 0)',
          100: 'oklch(0.97 0.00 0)',
          200: 'oklch(0.92 0.00 0)',
          300: 'oklch(0.87 0.00 0)',
          400: 'oklch(0.70 0.00 0)',
          500: 'oklch(0.55 0.00 0)',
          600: 'oklch(0.44 0.00 0)',
          700: 'oklch(0.37 0.00 0)',
          800: 'oklch(0.26 0.00 0)',
          900: 'oklch(0.13 0.00 0)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        arabic: ['Noto Sans Arabic', 'system-ui', 'sans-serif'],
      },
    },
  },
}