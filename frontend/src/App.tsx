import React, { Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation.tsx';
import OfflineIndicator from './components/OfflineIndicator';
import NotFound from './components/NotFound';
import RoutePending from './components/ui/RoutePending';
import UxObservabilityBootstrap from './components/UxObservabilityBootstrap';
import logo from './img/shotspot-mark.svg';

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
const AchievementsPage = React.lazy(() => import('./components/AchievementsPage'));
const UserProfile = React.lazy(() => import('./components/UserProfile'));
const MyAchievements = React.lazy(() => import('./components/MyAchievements'));
const CompetitionManagement = React.lazy(() => import('./components/CompetitionManagement'));
const CompetitionBracketView = React.lazy(() => import('./components/CompetitionBracketView'));
const CompetitionStandingsView = React.lazy(() => import('./components/CompetitionStandingsView'));
const SeriesManagement = React.lazy(() => import('./components/SeriesManagement'));
const AdvancedAnalytics = React.lazy(() => import('./components/AdvancedAnalytics'));
const TeamAnalytics = React.lazy(() => import('./components/TeamAnalytics'));
const ScheduledReports = React.lazy(() => import('./components/ScheduledReports'));
const ReportTemplates = React.lazy(() => import('./components/ReportTemplates'));
const SettingsPage = React.lazy(() => import('./components/SettingsPage'));
const UxObservabilityDashboard = React.lazy(() => import('./components/UxObservabilityDashboard'));

const RouteLoader = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<RoutePending />}>
    {children}
  </Suspense>
);

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <WebSocketProvider>
          <Router>
            <UxObservabilityBootstrap />
            <div className="App">
            <a className="skip-link" href="#app-main">Skip to main content</a>
            <OfflineIndicator />
            <header className="App-header">
              <div className="header-content">
                <div className="header-branding">
                  <img src={logo} alt="ShotSpot Logo" className="header-logo" loading="lazy" decoding="async" />
                  <h1>ShotSpot - Korfball Statistics</h1>
                </div>
                <Navigation />
              </div>
            </header>
            <main id="app-main" className="App-main" tabIndex={-1}>
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
                    <RouteLoader><AchievementsPage /></RouteLoader>
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
                    <RouteLoader><AdvancedAnalytics /></RouteLoader>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/team-analytics"
                element={
                  <ProtectedRoute minRole="coach">
                    <RouteLoader><TeamAnalytics /></RouteLoader>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ux-observability"
                element={
                  <ProtectedRoute minRole="admin">
                    <RouteLoader><UxObservabilityDashboard /></RouteLoader>
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
                    <RouteLoader><CompetitionManagement /></RouteLoader>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/competitions/:id/bracket"
                element={
                  <ProtectedRoute minRole="coach">
                    <RouteLoader><CompetitionBracketView /></RouteLoader>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/competitions/:id/standings"
                element={
                  <ProtectedRoute minRole="coach">
                    <RouteLoader><CompetitionStandingsView /></RouteLoader>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/series"
                element={
                  <ProtectedRoute minRole="coach">
                    <RouteLoader><SeriesManagement /></RouteLoader>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/report-templates"
                element={
                  <ProtectedRoute minRole="coach">
                    <RouteLoader><ReportTemplates /></RouteLoader>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scheduled-reports"
                element={
                  <ProtectedRoute minRole="coach">
                    <RouteLoader><ScheduledReports /></RouteLoader>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/export-settings"
                element={<Navigate to="/settings" replace />}
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <RouteLoader><SettingsPage /></RouteLoader>
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
          </Router>
        </WebSocketProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;