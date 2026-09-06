import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Multi-page app: one entry for the storefront ("/"), one for the admin
// panel ("/admin.html") — same routing shape as the original static site.
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy /api/* to the existing Express backend during local dev.
    // The backend is untouched — start it separately with `npm run dev`
    // inside the original project (or point this at your deployed API).
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
