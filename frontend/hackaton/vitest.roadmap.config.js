import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['roadmap-tests/**/*.roadmap-test.{js,jsx}'],
    setupFiles: './src/test/setup.js',
    globals: true,
    css: false,
    env: { VITE_API_URL: 'http://localhost:5000', VITE_GOOGLE_CLIENT_ID: '' },
  },
})

