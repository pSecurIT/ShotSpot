import React, { Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import TeamManagement from './components/TeamManagement';
import PlayerManagement from './components/PlayerManagement';
import UserManagement from './components/UserManagement';
import GameManagement from './components/GameManagement';
const LiveMatch = React.lazy(() => import('./components/LiveMatch'));
const ShotAnalytics = React.lazy(() => import('./components/ShotAnalytics'));
const ExportCenter = React.lazy(() => import('./components/ExportCenter'));
import MatchTemplates from './components/MatchTemplates';
const TwizzitIntegration = React.lazy(() => import('./components/TwizzitIntegration'));
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation.tsx';
import OfflineIndicator from './components/OfflineIndicator';
import logo from './img/ShotSpot_logo.png';

const RouteLoader = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading…</div>}>
    {children}
  </Suspense>
);

const App: React.FC = () => {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <Router>
          <div className="App">
          <OfflineIndicator />
          <header className="App-header">
            <div className="header-content">
              <div className="header-branding">
                <img src={logo} alt="ShotSpot Logo" className="header-logo" />
                <h1>ShotSpot - Korfball Statistics</h1>
              </div>
              <Navigation />
            </div>
          </header>
          <main>
            <Routes>
              <Route path="/" element={<Navigate to="/teams" replace />} />
              <Route path="/" element={<Navigate to="/games" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route 
                path="/games" 
                element={
                  <ProtectedRoute>
                    <GameManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/match/:gameId" 
                element={
                  <ProtectedRoute>
                    <RouteLoader><LiveMatch /></RouteLoader>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/analytics/:gameId" 
                element={
                  <ProtectedRoute>
                    <RouteLoader><ShotAnalytics /></RouteLoader>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/teams" 
                element={
                  <ProtectedRoute>
                    <TeamManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/players" 
                element={
                  <ProtectedRoute>
                    <PlayerManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/users" 
                element={
                  <ProtectedRoute>
                    <UserManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/exports" 
                element={
                  <ProtectedRoute>
                    <RouteLoader><ExportCenter /></RouteLoader>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/templates" 
                element={
                  <ProtectedRoute>
                    <MatchTemplates />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/twizzit" 
                element={
                  <ProtectedRoute>
                    <RouteLoader><TwizzitIntegration /></RouteLoader>
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </main>
        </div>
      </Router>
    </WebSocketProvider>
    </AuthProvider>
  );
};

export default App;