import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    proxy: { "/api": "http://localhost:3000" },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.tsx"],
  },
});
