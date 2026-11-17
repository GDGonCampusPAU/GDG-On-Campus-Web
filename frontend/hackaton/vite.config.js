import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import maintenance from './maintenance-plugin.js'

export default defineConfig({
  plugins: [react(), maintenance()],
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    css: false,
    // Tests assume neither is set; a developer's real .env must not leak in.
    env: { VITE_API_URL: 'http://localhost:5000', VITE_GOOGLE_CLIENT_ID: '' },
  },
})
