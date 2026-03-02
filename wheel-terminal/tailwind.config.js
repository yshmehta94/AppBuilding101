/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#070C09',
        card: '#0D1410',
        'primary-green': '#00DC78',
        'danger-red': '#FF4060',
        'warning-yellow': '#FFB800',
        'info-blue': '#5599FF',
        'csp-cyan': '#00C8FF',
        'cc-purple': '#AA88FF',
        'primary-text': '#E0F0E8',
        'muted-text': '#7A9A88',
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      animation: {
        'fade-up': 'fadeUp 200ms ease-out forwards',
        'pulse-danger': 'pulseDanger 1.4s infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDanger: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
    },
  },
  plugins: [],
}
