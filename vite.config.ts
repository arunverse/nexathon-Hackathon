import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createGoogleAuthDevMiddleware } from './src/server/googleAuthHandler'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'google-auth-dev-api',
        configureServer(server) {
          server.middlewares.use(createGoogleAuthDevMiddleware(env))
        },
      },
    ],
    server: {
      port: 8000,
      strictPort: true,
      host: true,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false, // skip clearing dist avoids EPERM on locked files
    },
    define: {
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(
        env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ''
      ),
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(
        env.VITE_GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || '536378349818-dc7n4ga6kuauepsd9sht3mb9d1sdcard.apps.googleusercontent.com'
      ),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        env.VITE_SUPABASE_URL || ''
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY || ''
      ),
    },
  }
})
