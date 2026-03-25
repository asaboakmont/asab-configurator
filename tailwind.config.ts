import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        asab: {
          black:  "#0F0E0D",
          cream:  "#F5F0E8",
          warm:   "#C8B89A",
          accent: "#8C6A3F",
          stone:  "#6B6560",
          light:  "#EDE8DF",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body:    ["var(--font-body)"],
      },
    },
  },
  plugins: [],
};

export default config;
