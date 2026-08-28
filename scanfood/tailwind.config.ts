import type { Config } from 'tailwindcss';

/**
 * Design tokens « Iuka » — éditorial, mature, épuré.
 * Un seul accent sobre (vert forêt) + un accent chaud discret (terracotta).
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#FAF8F4',
          deep: '#F3EFE7',
          dim: '#EBE5D9',
        },
        ink: {
          DEFAULT: '#1A1A1A',
          soft: '#4A4A46',
          mute: '#8A857C',
          faint: '#B8B2A6',
        },
        forest: {
          DEFAULT: '#1F3D2B',
          soft: '#2F5540',
          wash: '#E7EDE8',
        },
        terracotta: {
          DEFAULT: '#C2683B',
          soft: '#D48A63',
          wash: '#F6E9E1',
        },
        rule: '#DED8CC',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Fraunces', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        display: ['clamp(2.75rem, 12vw, 4.25rem)', { lineHeight: '0.92', letterSpacing: '-0.03em' }],
        score: ['clamp(3.5rem, 20vw, 6rem)', { lineHeight: '0.82', letterSpacing: '-0.045em' }],
        'score-sm': ['1.75rem', { lineHeight: '0.9', letterSpacing: '-0.03em' }],
        title: ['clamp(1.75rem, 7vw, 2.5rem)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        eyebrow: ['0.6875rem', { lineHeight: '1', letterSpacing: '0.16em' }],
      },
      spacing: {
        gutter: '1.375rem',
      },
      borderRadius: {
        card: '2px',
        pill: '999px',
      },
      transitionTimingFunction: {
        editorial: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      maxWidth: {
        app: '30rem',
      },
    },
  },
  plugins: [],
};

export default config;
