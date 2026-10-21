import js from '@eslint/js'
import globals from 'globals'
export default [
  { ignores: ['node_modules/**', 'dist/**'] },
  { files: ['src/**/*.{js,jsx}', 'vite.config.js'], ...js.configs.recommended,
    languageOptions: { globals: { ...globals.browser, ...globals.vitest }, parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', caughtErrors: 'none' }] } },
  { files: ['scripts/**/*.mjs', 'eslint.config.js'], languageOptions: { globals: globals.node } },
]
