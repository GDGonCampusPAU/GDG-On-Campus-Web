import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    css: false,
    // Tests assume neither is set; a developer's real .env must not leak in.
    env: { VITE_ADMIN_PASSWORD: '', VITE_REGISTER_ENDPOINT: '' },
  },
})
