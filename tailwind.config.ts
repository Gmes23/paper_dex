import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
     fontFamily: {
        sans: ["var(--font-geist-sans)"],
        mono: ["var(--font-geist-mono)"],
        "pixel-square": ["var(--font-geist-pixel-square)"],
        "pixel-grid": ["var(--font-geist-pixel-grid)"],
        "pixel-circle": ["var(--font-geist-pixel-circle)"],
        "pixel-triangle": ["var(--font-geist-pixel-triangle)"],
        "pixel-line": ["var(--font-geist-pixel-line)"],
      },
    },
  },
};

export default config;
