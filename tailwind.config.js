/** @type {import("tailwindcss").Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // We use data-theme attribute for day/night — not system dark mode
  darkMode: ["class", "[data-theme=\"night\"]"],
  theme: {
    extend: {
      fontFamily: {
        // App branded font — Inter only, no system fallback fonts
        sans: ["Inter", "ui-sans-serif", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      colors: {
        brand: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#052e16",
        },
        earth: {
          50:  "#fbf8f3",
          100: "#f5efe4",
          200: "#eadcc7",
          300: "#dcbf9f",
          400: "#cca077",
          500: "#bf8858",
          600: "#b1744c",
          700: "#945d3e",
          800: "#774c36",
          900: "#61402f",
        },
      },
    },
  },
  plugins: [],
};
