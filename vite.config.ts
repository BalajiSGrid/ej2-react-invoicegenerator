import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        preview: new URL('./preview.html', import.meta.url).pathname,
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
})
