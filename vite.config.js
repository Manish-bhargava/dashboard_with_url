// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://mhbodhi.medtalent.co/api', // Target API endpoint
        changeOrigin: true, // Ensures the proxy handles CORS for us
        secure: false, // Set to true if the target API uses a valid SSL certificate
        rewrite: (path) => path.replace(/^\/api/, ''), // Rewrites the path (removes '/api')
        // Additional headers if necessary, for example if the API requires Authorization
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Add authorization header if needed
            // proxyReq.setHeader('Authorization', 'Bearer YOUR_TOKEN_HERE');
          });
        },
      },
    },
  },
});
