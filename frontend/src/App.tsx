import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import TeamManagement from './components/TeamManagement';
import PlayerManagement from './components/PlayerManagement';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>Korfball Game Statistics</h1>
        </header>
        <main>
          <Routes>
            <Route path="/teams" element={<TeamManagement />} />
            <Route path="/players" element={<PlayerManagement />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;