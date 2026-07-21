import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'
import dotenv from 'dotenv'

dotenv.config()

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '::', // Listen on all IPv4 and IPv6 addresses (allows localhost and LAN IP access)
    port: 5000,
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    nodePolyfills({
      include: ['buffer', 'process']
    }),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        suppressWarnings: true
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 500 * 1024 * 1024 // 500MB limit for WASM files
      },
      manifest: {
        name: 'Sonic Music',
        short_name: 'Sonic',
        description: 'Your offline-first music library',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
      }
    })
  ],
  define: {
    'process.env': process.env
  }
})
