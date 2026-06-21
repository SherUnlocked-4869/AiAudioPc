import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClaudioProvider } from '@/hooks/useClaudio'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClaudioProvider>
      <App />
    </ClaudioProvider>
  </React.StrictMode>,
)
