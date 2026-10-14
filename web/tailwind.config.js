/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#090d16',
          800: '#0f172a',
          700: '#1e293b',
          600: '#334155',
          500: '#475569',
        },
        flaw: {
          too_fast: '#f43f5e',
          too_slow: '#f97316',
          long_pauses: '#eab308',
          missing_pauses: '#ec4899',
          monotone: '#8b5cf6',
          volume_drop: '#06b6d4',
          pitch_spike: '#ef4444',
          stumble_filler: '#14b8a6',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
