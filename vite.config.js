import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { join } from 'node:path'
import { makeStore, handleBugs } from './lib/bugs.js'
import { makeSoundStore, handleSounds } from './lib/sounds.js'
import { makeReviewStore, handleReviews } from './lib/reviews.js'
import { makeSyncStore, handleSync } from './lib/sync.js'

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

// Dev-only: /api/sounds, saving to .data/sounds.json (PIN 1234)
function soundsApi() {
  return {
    name: 'sounds-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/sounds', (req, res) => {
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', async () => {
          try {
            const [status, json] = await handleSounds(makeSoundStore(join(server.config.root, '.data')), req.method, body ? JSON.parse(body) : null, req.headers['x-bug-pin'], process.env.BUG_PIN || '1234')
            res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(json))
          } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e.message || e) })) }
        })
      })
    },
  }
}

// Dev-only: /api/reviews (Art Review Board verdicts), saving to .data/reviews.json (PIN 1234)
function reviewsApi() {
  return {
    name: 'reviews-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/reviews', (req, res) => {
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', async () => {
          try {
            const [status, json] = await handleReviews(makeReviewStore(join(server.config.root, '.data')), req.method, body ? JSON.parse(body) : null, req.headers['x-bug-pin'], process.env.BUG_PIN || '1234')
            res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(json))
          } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e.message || e) })) }
        })
      })
    },
  }
}

// Dev-only: /api/sync (sync codes), a file per code in .data/
function syncApi() {
  return {
    name: 'sync-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/sync', (req, res) => {
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', async () => {
          try {
            const [status, json] = await handleSync(makeSyncStore(join(server.config.root, '.data')), req.method, body ? JSON.parse(body) : null)
            res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(json))
          } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: String(e.message || e) })) }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), bugsApi(), soundsApi(), reviewsApi(), syncApi()],
  // the project lives in OneDrive, where file-change events get lost: poll instead (dev server only)
  server: { watch: { usePolling: true, interval: 250 } },
})
