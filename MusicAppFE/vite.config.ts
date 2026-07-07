import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true, // Listen on all local IPs
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    nodePolyfills({
      include: ['buffer', 'process']
    })
  ],
})
