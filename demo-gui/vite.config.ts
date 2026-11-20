/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { demoData } from './plugins/demo-data'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), demoData()],
  build: { chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] },
})
