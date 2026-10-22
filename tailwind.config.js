/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      screens: {
        // Desktop layout starts at 900px so Chrome's desktop mode on phones (980px) gets it too
        desk: '900px',
      },
    },
  },
  plugins: [],
}

