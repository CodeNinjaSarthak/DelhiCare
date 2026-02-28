import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
  build: {
    sourcemap: false, // Enable sourcemaps
  },
  esbuild: {
    sourcemap: true, // Ensure esbuild generates sourcemaps
  },
});
