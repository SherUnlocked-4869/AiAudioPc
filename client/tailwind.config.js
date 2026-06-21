/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        'panel-2': 'var(--panel-2)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        'accent-2': 'var(--accent-2)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        danger: 'var(--danger)',
        glass: 'var(--glass)',
        'glass-2': 'var(--glass-2)',
        'glass-input': 'var(--glass-input)',
      },
    },
  },
  plugins: [],
}
