import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import dotenv from 'dotenv'

dotenv.config()

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '::', // Listen on all IPv4 and IPv6 addresses (allows localhost and LAN IP access)
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    nodePolyfills({
      include: ['buffer', 'process']
    })
  ],
  define: {
    'process.env': process.env
  }
})
