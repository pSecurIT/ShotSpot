import React, { Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation.tsx';
import OfflineIndicator from './components/OfflineIndicator';
import ComingSoon from './components/ComingSoon';
import NotFound from './components/NotFound';
import logo from './img/ShotSpot_logo.png';

const Dashboard = React.lazy(() => import('./components/Dashboard'));
const GameManagement = React.lazy(() => import('./components/GameManagement'));
const LiveMatch = React.lazy(() => import('./components/LiveMatch'));
const ShotAnalytics = React.lazy(() => import('./components/ShotAnalytics'));
const TeamManagement = React.lazy(() => import('./components/TeamManagement'));
const ClubManagement = React.lazy(() => import('./components/ClubManagement'));
const PlayerManagement = React.lazy(() => import('./components/PlayerManagement'));
const UserManagement = React.lazy(() => import('./components/UserManagement'));
const ExportCenter = React.lazy(() => import('./components/ExportCenter'));
const MatchTemplates = React.lazy(() => import('./components/MatchTemplates'));
const TwizzitIntegration = React.lazy(() => import('./components/TwizzitIntegration'));
const Achievements = React.lazy(() => import('./components/Achievements'));
const UserProfile = React.lazy(() => import('./components/UserProfile'));
const MyAchievements = React.lazy(() => import('./components/MyAchievements'));

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
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <RouteLoader><Dashboard /></RouteLoader>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/match"
                element={
                  <ProtectedRoute>
                    <Navigate to="/games" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <Navigate to="/games" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/achievements"
                element={
                  <ProtectedRoute>
                    <RouteLoader><Achievements /></RouteLoader>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <RouteLoader><UserProfile /></RouteLoader>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-achievements"
                element={
                  <ProtectedRoute>
                    <RouteLoader><MyAchievements /></RouteLoader>
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/games" 
                element={
                  <ProtectedRoute>
                    <RouteLoader><GameManagement /></RouteLoader>
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
                    <RouteLoader><TeamManagement /></RouteLoader>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/players" 
                element={
                  <ProtectedRoute>
                    <RouteLoader><PlayerManagement /></RouteLoader>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/users" 
                element={
                  <ProtectedRoute minRole="admin">
                    <RouteLoader><UserManagement /></RouteLoader>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/exports" 
                element={
                  <ProtectedRoute minRole="coach">
                    <RouteLoader><ExportCenter /></RouteLoader>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/templates" 
                element={
                  <ProtectedRoute minRole="coach">
                    <RouteLoader><MatchTemplates /></RouteLoader>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/twizzit" 
                element={
                  <ProtectedRoute minRole="coach">
                    <RouteLoader><TwizzitIntegration /></RouteLoader>
                  </ProtectedRoute>
                } 
              />

              {/* New navigation routes (some are placeholders / "Soon") */}
              <Route
                path="/advanced-analytics"
                element={
                  <ProtectedRoute minRole="coach">
                    <ComingSoon title="Advanced Analytics" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/team-analytics"
                element={
                  <ProtectedRoute minRole="coach">
                    <ComingSoon title="Team Analytics" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clubs"
                element={
                  <ProtectedRoute minRole="coach">
                    <RouteLoader><ClubManagement /></RouteLoader>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/competitions"
                element={
                  <ProtectedRoute minRole="coach">
                    <ComingSoon title="Competitions" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/series"
                element={
                  <ProtectedRoute minRole="coach">
                    <ComingSoon title="Series / Divisions" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/report-templates"
                element={
                  <ProtectedRoute minRole="coach">
                    <ComingSoon title="Report Templates" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scheduled-reports"
                element={
                  <ProtectedRoute minRole="coach">
                    <ComingSoon title="Scheduled Reports" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/export-settings"
                element={
                  <ProtectedRoute minRole="coach">
                    <ComingSoon title="Export Settings" />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </Router>
    </WebSocketProvider>
    </AuthProvider>
  );
};

export default App;