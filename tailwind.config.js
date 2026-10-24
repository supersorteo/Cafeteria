const token = name => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        coral: 'var(--coral)',
        mango: 'var(--mango)',
        teal: 'var(--teal)',
        plum: 'var(--plum)',
        cream: 'var(--cream)',
        app: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        line: token('line'),
        ink: token('text'),
        muted: token('muted'),
        primary: token('primary'),
        'primary-fg': token('primary-fg'),
        gold: token('gold'),
        brand: token('brand-teal'),
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
      },
      fontFamily: {
        display: 'var(--font-display)',
        ui: 'var(--font-ui)',
      },
      borderRadius: {
        'ui-sm': 'var(--r-sm)',
        'ui-md': 'var(--r-md)',
        'ui-lg': 'var(--r-lg)',
        'ui-xl': 'var(--r-xl)',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(var(--shadow-rgb) / calc(.05 * var(--shadow-a))), 0 12px 32px -16px rgb(var(--shadow-rgb) / calc(.18 * var(--shadow-a)))',
        lift: '0 2px 4px rgb(var(--shadow-rgb) / calc(.06 * var(--shadow-a))), 0 22px 44px -18px rgb(var(--shadow-rgb) / calc(.28 * var(--shadow-a)))',
        glow: '0 10px 30px -8px rgb(var(--primary) / .55)',
      },
      transitionTimingFunction: {
        'out-expo': 'var(--ease-out)',
        spring: 'var(--ease-spring)',
      },
    },
  },
  plugins: [],
};
