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
      },
    },
  },
  plugins: [],
};
