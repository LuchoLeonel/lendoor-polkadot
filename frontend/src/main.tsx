import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { DynamicProvider } from '@/providers/DynamicProvider'
import { UserJourneyProvider } from '@/providers/UserJourneyProvider.js'
import { VLayerProvider } from '@/providers/VLayerProvider.js'
import { ContractsProvider } from '@/providers/ContractsProvider.js'
import { UserProvider } from './providers/UserProvider.js'
import { Toaster } from 'sonner';
import App from './App.jsx'
import 'buffer' 
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <DynamicProvider>
        <VLayerProvider>
          <UserJourneyProvider>
            <ContractsProvider>
              <UserProvider>
                <Suspense fallback={null}>
                  <App />
                </Suspense>
                <Toaster richColors position="top-center" />
              </UserProvider>
            </ContractsProvider>
          </UserJourneyProvider>
        </VLayerProvider>
      </DynamicProvider>
    </BrowserRouter>
  </StrictMode>
)