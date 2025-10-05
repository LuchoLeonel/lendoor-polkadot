import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { DynamicProvider } from '@/components/providers/DynamicProvider'
import { UserJourneyProvider } from '@/components/providers/UserProvider'
import './index.css'
import App from './App.jsx'

import 'buffer' 
import { VLayerProvider } from './components/providers/VLayerProvider.js'
import { VaultProvider } from './components/providers/VaultProvider.js'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DynamicProvider>
      <UserJourneyProvider>
        <VLayerProvider>
          <VaultProvider>
            <BrowserRouter>
              <Suspense fallback={null}>
                <App />
              </Suspense>
            </BrowserRouter>
            </VaultProvider>
        </VLayerProvider>
      </UserJourneyProvider>
    </DynamicProvider>
  </StrictMode>
)