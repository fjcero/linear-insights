import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/report": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        timeout: 300000, // 5 min — initial sync can be slow with many projects
      },
      "/report.json": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        timeout: 300000,
      },
      "/auth": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});
