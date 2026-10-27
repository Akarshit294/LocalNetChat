import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // where uvicorn is listening, on this same machine
  const port = loadEnv(mode, process.cwd()).VITE_SERVER_PORT ?? '8000'
  const backend = `http://127.0.0.1:${port}`

  return {
    // basicSsl makes a self-signed certificate and serves the page over https.
    // A browser only hands the camera and microphone to a secure page, so calls
    // need it. No CA signed that certificate, so every device warns once and you
    // choose to go on.
    plugins: [react(), basicSsl()],
    server: {
      // An https page may not call an http:// or ws:// address (mixed content),
      // so the page no longer dials the backend itself. It asks this server, on
      // its own origin, and these two rules pass the request on to uvicorn.
      proxy: {
        '/api': { target: backend, rewrite: (path) => path.replace(/^\/api/, '') },
        '/ws': { target: backend, ws: true },
      },
    },
  }
})
