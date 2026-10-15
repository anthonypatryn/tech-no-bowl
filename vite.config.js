import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { join } from 'node:path'
import { makeStore, handleBugs } from './lib/bugs.js'

// Dev-only: /api/bugs runs the same code as the Vercel function, saving to .data/bugs.json (PIN 1234)
function bugsApi() {
  return {
    name: 'bugs-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/bugs', (req, res) => {
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', async () => {
          try {
            const store = makeStore(join(server.config.root, '.data'))
            const [status, json] = await handleBugs(store, req.method, body ? JSON.parse(body) : null, req.headers['x-bug-pin'], process.env.BUG_PIN || '1234')
            res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(json))
          } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e.message || e) })) }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), bugsApi()],
  // the project lives in OneDrive, where file-change events get lost: poll instead (dev server only)
  server: { watch: { usePolling: true, interval: 250 } },
})
