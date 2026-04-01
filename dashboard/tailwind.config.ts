import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        lssu: {
          navy:  "#003F6B",
          gold:  "#C8992A",
          light: "#E8F4FD",
        },
      },
    },
  },
  plugins: [],
};

export default config;
