import { defineConfig, splitVendorChunkPlugin } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), splitVendorChunkPlugin()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://127.0.0.1:31881',
        ws: true
      },
      '/api': {
        target: 'http://127.0.0.1:31881'
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'socket.io-client', 'framer-motion']
  },
  build: {
    target: 'es2019',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          if (id.includes('/framer-motion/')) {
            return 'motion';
          }
          if (id.includes('/socket.io-client/')) {
            return 'socket';
          }
          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'react-vendor';
          }
          return 'vendor';
        }
      }
    }
  }
});
