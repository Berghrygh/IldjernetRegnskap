import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes the production build run from file:// so the treasurer
// can open dist/index.html directly without a server.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
