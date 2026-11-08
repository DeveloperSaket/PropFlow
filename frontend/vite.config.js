import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:5112';
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API + uploads to the Express backend during development
      '/api': apiTarget,
      '/uploads': apiTarget,
    },
    css: {
      preprocessorOptions: {
        scss: {
          // Modern Sass compiler configuration
          api: 'modern',
          // api: 'modern-compiler',
          // Automatically injects global SCSS variables into every SCSS file
          additionalData: `@use "@/styles/_variables.scss" as *;`
        }
      }
    }
  },
});
