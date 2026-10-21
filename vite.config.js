import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { attachTranslationApi } from './server/translateApi.js'

function translationApiPlugin() {
  const attach = (server) => {
    attachTranslationApi(server.middlewares)
  }

  return {
    name: 'translation-api',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

export default defineConfig({
  plugins: [translationApiPlugin(), vue(), tailwindcss()],
})
