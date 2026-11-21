import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { seo } from "./seo-plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), seo()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8000" },
  },
});
