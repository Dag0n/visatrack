import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const allowedHosts = ['visatrack.uk', '192.168.200.169', 'localhost']

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts,
  },
  preview: {
    allowedHosts,
  },
})
