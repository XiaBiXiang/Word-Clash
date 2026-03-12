/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: '#21d4fd',
          blue: '#3461ff',
          pink: '#ff4ecd',
          green: '#34d399',
          red: '#ff4b6e'
        }
      },
      boxShadow: {
        neon: '0 0 25px rgba(33, 212, 253, 0.45)',
        card: '0 25px 60px rgba(2, 6, 23, 0.45)'
      }
    }
  },
  plugins: []
};
