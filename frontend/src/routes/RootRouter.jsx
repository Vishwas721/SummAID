import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '../auth/ProtectedRoute'
import LoginPage from '../pages/LoginPage'
import Dashboard from '../pages/Dashboard'

export default function RootRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}> 
        <Route path="/" element={<Dashboard />} />
      </Route>
      {/* Catch-all: redirect unknown routes to login or dashboard based on auth could be added */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
