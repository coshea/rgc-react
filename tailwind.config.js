// tailwind.config.js
// HeroUI v3 does not require a Tailwind plugin — styles are loaded via
// @import "@heroui/styles" in globals.css

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [],
};
