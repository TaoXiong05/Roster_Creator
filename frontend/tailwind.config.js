// frontend/tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dusk: {
          DEFAULT: '#5B4B75',
          light: '#7C6796',
          dark: '#3E3253',
        },
        coral: {
          DEFAULT: '#E8834F',
          light: '#F4A97C',
          deep: '#C9642F',
        },
        sand: {
          DEFAULT: '#FFF3E2',
          deep: '#FCE8CE',
        },
        eucalyptus: {
          DEFAULT: '#6F9273',
          dark: '#57785C',
        },
        tan: {
          DEFAULT: '#C98B5E',
          light: '#E3B58C',
        },
        ink: {
          DEFAULT: '#3A2B22',
          soft: '#6B5647',
        },
      },
      fontFamily: {
        display: ['Fredoka', 'sans-serif'],
        body: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        warm: '0 20px 40px -16px rgba(139, 94, 61, 0.35)',
        'warm-sm': '0 8px 20px -8px rgba(139, 94, 61, 0.28)',
        'warm-inner': 'inset 0 1px 0 rgba(255, 255, 255, 0.5)',
      },
      keyframes: {
        bob: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(-1deg)' },
        },
        hopIn: {
          '0%': { transform: 'translateY(50px) scale(0.88)', opacity: '0' },
          '55%': { transform: 'translateY(-12px) scale(1.03)', opacity: '1' },
          '75%': { transform: 'translateY(4px) scale(0.99)' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        earTwitch: {
          '0%, 88%, 100%': { transform: 'rotate(0deg)' },
          '92%': { transform: 'rotate(-7deg)' },
          '96%': { transform: 'rotate(4deg)' },
        },
        riseIn: {
          '0%': { transform: 'translateY(14px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        wave: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-14deg)' },
          '75%': { transform: 'rotate(10deg)' },
        },
      },
      animation: {
        bob: 'bob 3.8s ease-in-out infinite',
        'hop-in': 'hopIn 0.85s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'ear-twitch': 'earTwitch 5.5s ease-in-out infinite',
        'rise-in': 'riseIn 0.6s ease-out both',
        wave: 'wave 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
