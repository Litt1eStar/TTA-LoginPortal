import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    // The API (server/) listens on 3001; the Google OAuth callback also comes through here
    proxy: { '/api': 'http://localhost:3001' }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js']
  }
});
