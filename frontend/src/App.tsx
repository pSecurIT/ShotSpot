import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import TeamManagement from './components/TeamManagement';
import PlayerManagement from './components/PlayerManagement';
import UserManagement from './components/UserManagement';
import GameManagement from './components/GameManagement';
import LiveMatch from './components/LiveMatch';
import ShotAnalytics from './components/ShotAnalytics';
import ExportCenter from './components/ExportCenter';
import MatchTemplates from './components/MatchTemplates';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation.tsx';
import OfflineIndicator from './components/OfflineIndicator';
import logo from './img/ShotSpot_logo.png';

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
                    <LiveMatch />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/analytics/:gameId" 
                element={
                  <ProtectedRoute>
                    <ShotAnalytics />
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
                    <ExportCenter />
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
            </Routes>
          </main>
        </div>
      </Router>
    </WebSocketProvider>
    </AuthProvider>
  );
};

export default App;