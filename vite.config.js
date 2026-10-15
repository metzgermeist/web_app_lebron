import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    host: "127.0.0.1",
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.data/**', '**/*.sqlite', '**/*.sqlite-*'] },
    proxy: {
      // Conservar Host para que la API pueda comprobar el Origin del navegador.
      "/api": { target: "http://127.0.0.1:3001", changeOrigin: false },
      "/uploads": { target: "http://127.0.0.1:3001", changeOrigin: false },
      "/media": { target: "http://127.0.0.1:3001", changeOrigin: false },
      "/img": { target: "http://127.0.0.1:3001", changeOrigin: false },
    },
  },
  build: {
    outDir: "dist",
  },
});
