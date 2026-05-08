import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        repasseur: {
          DEFAULT: "#1E3A8A",
          light: "#2563EB",
          muted: "#64748B",
        },
        "repasseur-accent": "#E63946",
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        lobster: ["var(--font-lobster)", "cursive"],
      },
    },
  },
  plugins: [],
} satisfies Config;
