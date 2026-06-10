/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hl: {
          navy: '#002B8F',
          navyDark: '#001E66',
          navyLight: '#335FBF',
          accent: '#00D1FF',
        }
      }
    },
  },
  plugins: [],
}
