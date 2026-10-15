import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/press-start-2p'
import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/600.css'
import './index.css'
import App from './App.jsx'
import { unlockAudioOnFirstTap, loadSoundOverrides } from './game/sound'

unlockAudioOnFirstTap()
loadSoundOverrides()

// canvas-painted textures (later: scoreboard, labels) need the fonts ready first
const fonts = ['16px "Press Start 2P"', '400 16px "Pixelify Sans"']
Promise.all(fonts.map((f) => document.fonts.load(f, 'Aa 0123456789'))).finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
