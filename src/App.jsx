import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Components
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

// Pages
const Login = lazy(() => import('./pages/Login'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const ClientList = lazy(() => import('./pages/admin/ClientList'))
const AddClient = lazy(() => import('./pages/admin/AddClient'))
const EditClient = lazy(() => import('./pages/admin/EditClient'))
const ClientDetail = lazy(() => import('./pages/admin/ClientDetail'))
const GoalProgressAdmin = lazy(() => import('./pages/admin/GoalProgressAdmin'))
const WeeklyCheckinAdmin = lazy(() => import('./pages/admin/WeeklyCheckinAdmin'))
const ClientDashboard = lazy(() => import('./pages/client/Dashboard'))
const ClientProfile = lazy(() => import('./pages/client/Profile'))
const MeasurementHistory = lazy(() => import('./pages/client/MeasurementHistory'))
const ClientGoals = lazy(() => import('./pages/client/ClientGoals'))
const ClientCoachNotes = lazy(() => import('./pages/client/ClientCoachNotes'))
const WeeklyCheckinClient = lazy(() => import('./pages/client/WeeklyCheckinClient'))

function RouteLoading() {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
    </div>
  )
}

/**
 * App Component - Main router configuration
 * Defines all routes with role-based access control
 */
export default function App() {
  const { user, loading } = useAuth()

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        {/* Public Route: Login */}
        <Route path="/login" element={<Login />} />

        {/* Admin Routes */}
        <Route
          element={
            <ProtectedRoute allowedRole="admin">
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/clients" element={<ClientList />} />
          <Route path="/admin/clients/add" element={<AddClient />} />
          <Route path="/admin/clients/:id" element={<ClientDetail />} />
          <Route path="/admin/clients/:id/edit" element={<EditClient />} />
          <Route path="/admin/goals" element={<GoalProgressAdmin />} />
          <Route path="/admin/checkins" element={<WeeklyCheckinAdmin />} />
        </Route>

        {/* Client Routes */}
        <Route
          element={
            <ProtectedRoute allowedRole="client">
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/client/dashboard" element={<ClientDashboard />} />
          <Route path="/client/profile" element={<ClientProfile />} />
          <Route path="/client/goals" element={<ClientGoals />} />
          <Route path="/client/measurements" element={<MeasurementHistory />} />
          <Route path="/client/notes" element={<ClientCoachNotes />} />
          <Route path="/client/checkins" element={<WeeklyCheckinClient />} />
        </Route>

        {/* Default redirect */}
        <Route
          path="*"
          element={
            user ? (
              <Navigate
                to={user.role === 'admin' ? '/admin/dashboard' : '/client/dashboard'}
                replace
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Suspense>
  )
}
