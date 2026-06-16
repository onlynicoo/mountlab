import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useLoader } from '@react-three/fiber'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import './index.css'
import App from './App.jsx'
import { CHASSIS_COMPONENTS } from './config/chassisComponents'

CHASSIS_COMPONENTS.forEach((component) => {
  useLoader.preload(STLLoader, component.path)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
