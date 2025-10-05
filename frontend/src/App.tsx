// src/App.jsx
import { Routes, Route } from 'react-router-dom'
import { Header } from '@/components/common/Header'
import Home from '@/pages/Home'
import BorrowPage from '@/pages/Borrow'
import LendPage from '@/pages/Lend'

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header sin grid */}
      <Header />

      {/* Contenido con grid detrás */}
      <div className="relative flex-1">
        {/* 👇 fondo grid */}
        <div className="absolute inset-0 z-0 pointer-events-none terminal-grid [background-attachment:local]" />


        {/* contenido principal arriba */}
        <main className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/borrow" element={<BorrowPage />} />
            <Route path="/lend" element={<LendPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
