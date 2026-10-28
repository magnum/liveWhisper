import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { attachSessionApi } from './server/sessionApi.js'
import { attachTranslationApi } from './server/translateApi.js'

function liveWhisperApi() {
  const attach = (server) => {
    const getPort = () => {
      const address = server.httpServer?.address?.()
      return address && typeof address === 'object' ? address.port : 5173
    }
    attachTranslationApi(server.middlewares)
    attachSessionApi(server.middlewares, { getPort })
  }

  return {
    name: 'livewhisper-api',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

export default defineConfig({
  server: { host: true },
  preview: { host: true },
  plugins: [liveWhisperApi(), vue(), tailwindcss()],
})
