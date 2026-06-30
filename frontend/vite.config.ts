import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "0.0.0.0",
    allowedHosts: ["all", "ec7c2d7b-6a2e-4860-a933-46e78a184df7-00-1yn3nox7y0eth.pike.replit.dev"],
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
