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
        'bg-0': '#0E1116',
        'bg-1': '#151A21',
        'bg-2': '#1C232C',
        'border-ui': '#2A333E',
        'text-1': '#E6EAF0',
        'text-2': '#9AA5B1',
        'accent': '#2FBF9B',
        'baseline': '#8B96A3',
        flaw: {
          pacing: '#E69F00',
          pauses: '#56B4E9',
          pitch: '#CC79A7',
          energy: '#F0E442',
          clarity: '#D55E00',
        }
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        md: '6px',
        lg: '6px',
      }
    },
  },
  plugins: [],
}
