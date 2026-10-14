/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0EFFF',
          100: '#E2E0FF',
          200: '#C7C2FF',
          300: '#A49CFF',
          400: '#7E6EFF',
          500: '#5B4DFB', // Primary AudioEnhancer purple/indigo
          600: '#4A3CE5',
          700: '#3A2CC4',
          800: '#2C2096',
          900: '#1D146A',
        },
        surface: {
          ground: '#F6F8FC',
          card: '#FFFFFF',
          border: '#E2E8F0',
          subtle: '#F1F5F9',
        },
        flaw: {
          too_fast: '#EF4444',
          too_slow: '#F97316',
          long_pauses: '#EAB308',
          missing_pauses: '#EC4899',
          monotone: '#8B5CF6',
          volume_drop: '#0284C7',
          pitch_spike: '#DC2626',
          stumble_filler: '#0D9488',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'card': '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -2px rgba(15, 23, 42, 0.03)',
        'elevated': '0 12px 32px -4px rgba(91, 77, 251, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.04)',
        'glow': '0 0 25px rgba(91, 77, 251, 0.25)',
      }
    },
  },
  plugins: [],
}
