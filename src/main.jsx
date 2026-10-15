import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/press-start-2p'
import '@fontsource/chakra-petch/400.css'
import '@fontsource/chakra-petch/600.css'
import '@fontsource/chakra-petch/700.css'
import './index.css'
import App from './App.jsx'

// canvas-painted textures (later: scoreboard, labels) need the fonts ready first
const fonts = ['16px "Press Start 2P"', '600 16px "Chakra Petch"']
Promise.all(fonts.map((f) => document.fonts.load(f, 'Aa 0123456789'))).finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
