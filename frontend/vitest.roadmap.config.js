import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['roadmap-tests/**/*.roadmap-test.{js,jsx}'],
    setupFiles: './src/test/setup.js',
  },
})

