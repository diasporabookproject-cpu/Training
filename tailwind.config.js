/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f17",
        panel: "#121826",
        "panel-2": "#1a2233",
        line: "#222c40",
        ink: "#e8edf5",
        muted: "#8a96ac",
        accent: "#f59e0b",
        "accent-soft": "#f59e0b22",
        up: "#22c55e",
        flat: "#f59e0b",
        down: "#ef4444",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
