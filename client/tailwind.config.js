/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        razk: {
          50: "#f8fafc",
          100: "#f1f5f9",
          500: "#94a3b8",
          600: "#64748b",
          700: "#475569",
          900: "#0f172a",
          950: "#020617"
        }
      },
      boxShadow: {
        panel: "0 18px 50px rgba(31, 51, 49, 0.12)"
      }
    }
  },
  plugins: []
};
