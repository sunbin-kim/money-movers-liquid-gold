/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand — always gold regardless of theme
        gold: {
          DEFAULT: '#f0b429',
          dark:    '#c98a00',
          pale:    '#2a2000',
        },
        // Theme-aware surfaces (driven by CSS variables)
        surface: {
          DEFAULT: 'var(--surface)',
          2:       'var(--surface-2)',
        },
        border: {
          DEFAULT: 'var(--border)',
          2:       'var(--border-2)',
        },
        // Text
        ink:   'var(--text)',
        muted: 'var(--muted)',
        // Page background
        bg:    'var(--bg)',
      },
      fontFamily: {
        sans: ['-apple-system', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
