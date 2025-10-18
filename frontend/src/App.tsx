import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import TeamManagement from './components/TeamManagement';
import PlayerManagement from './components/PlayerManagement';
import UserManagement from './components/UserManagement';
import GameManagement from './components/GameManagement';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';
import Navigation from './components/Navigation.tsx';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <header className="App-header">
            <h1>ShotSpot - Korfball Statistics</h1>
            <Navigation />
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
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;