import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API + uploads to the Express backend during development
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
    css: {
      preprocessorOptions: {
        scss: {
          // Modern Sass compiler configuration
          api: 'modern-compiler',
          // Automatically injects global SCSS variables into every SCSS file
          additionalData: `@use "@/styles/_variables.scss" as *;`
        }
      }
    }
  },
});
