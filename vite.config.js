import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@phosphor-icons/react', 'canvas-confetti']
  },
  server: {
    port: 3000,
    open: true,
    // The API (server/) listens on IPv4 127.0.0.1:3001; use 127.0.0.1 directly to avoid Windows IPv6 (::1) fallback delay
    proxy: { '/api': 'http://127.0.0.1:3001' }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          icons: ['@phosphor-icons/react']
        }
      }
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js']
  }
});
