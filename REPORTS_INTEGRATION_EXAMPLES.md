# Real-Time Match Reports - Integration Examples

This guide provides practical integration examples for the new Real-Time Match Reports API endpoints.

## Table of Contents
1. [React Component Examples](#react-component-examples)
2. [Vue.js Examples](#vuejs-examples)
3. [Vanilla JavaScript Examples](#vanilla-javascript-examples)
4. [Error Handling Patterns](#error-handling-patterns)
5. [Performance Optimization](#performance-optimization)

---

## React Component Examples

### Live Match Dashboard Component

```jsx
import React, { useState, useEffect } from 'react';

function LiveMatchDashboard({ gameId, authToken }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLiveReport = async () => {
      try {
        const response = await fetch(`/api/reports/live/${gameId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setReport(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    // Initial fetch
    fetchLiveReport();

    // Poll every 5 seconds for live updates
    const interval = setInterval(fetchLiveReport, 5000);

    return () => clearInterval(interval);
  }, [gameId, authToken]);

  if (loading) return <div>Loading live report...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!report) return null;

  return (
    <div className="live-match-dashboard">
      <div className="score-section">
        <h2>Live Score</h2>
        <div className="score">
          <span>{report.game.home_team}: {report.game.home_score}</span>
          <span> - </span>
          <span>{report.game.away_team}: {report.game.away_score}</span>
        </div>
        <div className="game-info">
          Period {report.game.current_period} - {report.game.time_remaining}
        </div>
      </div>

      <div className="shot-summary">
        <h3>Shot Summary</h3>
        {report.shot_summary.map(team => (
          <div key={team.team_id} className="team-stats">
            <h4>{team.team_name}</h4>
            <p>FG%: {team.fg_percentage}%</p>
            <p>{team.goals} / {team.total_shots}</p>
          </div>
        ))}
      </div>

      <div className="top-scorers">
        <h3>Top Scorers</h3>
        <ul>
          {report.top_scorers.map(scorer => (
            <li key={scorer.player_id}>
              #{scorer.jersey_number} {scorer.name} - {scorer.goals} goals
            </li>
          ))}
        </ul>
      </div>

      <div className="recent-events">
        <h3>Recent Events</h3>
        <ul>
          {report.recent_events.map(event => (
            <li key={event.id}>
              {event.event_type} - {event.team_name} 
              {event.player_name && ` (${event.player_name})`}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default LiveMatchDashboard;
```

### Momentum Tracker Component

```jsx
import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';

function MomentumTracker({ gameId, authToken }) {
  const [momentum, setMomentum] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchMomentum = async () => {
      try {
        const response = await fetch(`/api/reports/momentum/${gameId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        setMomentum(data);
        
        // Add to history for trend visualization
        setHistory(prev => [...prev.slice(-19), {
          timestamp: new Date(),
          home: data.momentum.home,
          away: data.momentum.away
        }]);
      } catch (err) {
        console.error('Error fetching momentum:', err);
      }
    };

    fetchMomentum();
    const interval = setInterval(fetchMomentum, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [gameId, authToken]);

  if (!momentum) return <div>Loading momentum...</div>;

  const chartData = {
    labels: history.map((_, i) => `${i * 10}s ago`).reverse(),
    datasets: [
      {
        label: 'Home Team Momentum',
        data: history.map(h => h.home).reverse(),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      },
      {
        label: 'Away Team Momentum',
        data: history.map(h => h.away).reverse(),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1
      }
    ]
  };

  return (
    <div className="momentum-tracker">
      <h3>Momentum Tracker</h3>
      <div className="momentum-bars">
        <div className="home-momentum">
          <div 
            className="bar" 
            style={{ width: `${Math.abs(momentum.momentum.home)}%` }}
          >
            Home: {momentum.momentum.home}
          </div>
        </div>
        <div className="away-momentum">
          <div 
            className="bar" 
            style={{ width: `${Math.abs(momentum.momentum.away)}%` }}
          >
            Away: {momentum.momentum.away}
          </div>
        </div>
      </div>
      <p className="trend">Trend: {momentum.momentum.trend}</p>
      
      {history.length > 0 && (
        <div className="momentum-chart">
          <Line data={chartData} options={{ scales: { y: { min: -100, max: 100 } } }} />
        </div>
      )}
    </div>
  );
}

export default MomentumTracker;
```

### Period Report Component

```jsx
import React, { useState } from 'react';

function PeriodReport({ gameId, authToken }) {
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchPeriodReport = async (period) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reports/period/${gameId}/${period}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();
      setReport(data);
    } catch (err) {
      console.error('Error fetching period report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    fetchPeriodReport(period);
  };

  React.useEffect(() => {
    fetchPeriodReport(1);
  }, [gameId]);

  return (
    <div className="period-report">
      <div className="period-selector">
        {[1, 2, 3, 4].map(period => (
          <button
            key={period}
            onClick={() => handlePeriodChange(period)}
            className={selectedPeriod === period ? 'active' : ''}
          >
            Period {period}
          </button>
        ))}
      </div>

      {loading && <div>Loading...</div>}
      
      {report && !loading && (
        <div className="report-content">
          <h3>Period {report.period} Statistics</h3>
          
          <div className="team-stats">
            {report.team_stats.map(team => (
              <div key={team.team_id} className="team-card">
                <h4>{team.team_name}</h4>
                <div className="stats-grid">
                  <div>Goals: {team.goals}</div>
                  <div>Shots: {team.total_shots}</div>
                  <div>FG%: {team.fg_percentage}%</div>
                  <div>Avg Distance: {team.avg_distance}m</div>
                </div>
              </div>
            ))}
          </div>

          <div className="player-stats">
            <h4>Player Performance</h4>
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Shots</th>
                  <th>Goals</th>
                  <th>FG%</th>
                </tr>
              </thead>
              <tbody>
                {report.player_stats.map(player => (
                  <tr key={player.player_id}>
                    <td>#{player.jersey_number} {player.name}</td>
                    <td>{player.team_name}</td>
                    <td>{player.shots}</td>
                    <td>{player.goals}</td>
                    <td>{player.fg_percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default PeriodReport;
```

### Export Report Button

```jsx
import React, { useState } from 'react';

function ExportReportButton({ gameId, authToken }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format = 'json') => {
    setExporting(true);
    try {
      const response = await fetch(
        `/api/reports/export/${gameId}?format=${format}`,
        {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }
      );

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `game-${gameId}-report.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting report:', err);
      alert('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="export-buttons">
      <button 
        onClick={() => handleExport('json')} 
        disabled={exporting}
      >
        {exporting ? 'Exporting...' : 'Export Full Report'}
      </button>
      <button 
        onClick={() => handleExport('summary')} 
        disabled={exporting}
      >
        {exporting ? 'Exporting...' : 'Export Summary'}
      </button>
    </div>
  );
}

export default ExportReportButton;
```

---

## Vue.js Examples

### Live Dashboard (Vue 3 Composition API)

```vue
<template>
  <div class="live-match-dashboard" v-if="report">
    <div class="score-section">
      <h2>{{ report.game.home_team }} {{ report.game.home_score }} - 
          {{ report.game.away_score }} {{ report.game.away_team }}</h2>
      <p>Period {{ report.game.current_period }} - {{ report.game.time_remaining }}</p>
    </div>

    <div class="shot-summary">
      <div v-for="team in report.shot_summary" :key="team.team_id">
        <h3>{{ team.team_name }}</h3>
        <p>FG%: {{ team.fg_percentage }}%</p>
      </div>
    </div>

    <div class="top-scorers">
      <h3>Top Scorers</h3>
      <ul>
        <li v-for="scorer in report.top_scorers" :key="scorer.player_id">
          #{{ scorer.jersey_number }} {{ scorer.name }} - {{ scorer.goals }} goals
        </li>
      </ul>
    </div>
  </div>
  <div v-else-if="loading">Loading...</div>
  <div v-else-if="error">Error: {{ error }}</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  gameId: Number,
  authToken: String
});

const report = ref(null);
const loading = ref(true);
const error = ref(null);
let intervalId = null;

const fetchLiveReport = async () => {
  try {
    const response = await fetch(`/api/reports/live/${props.gameId}`, {
      headers: {
        'Authorization': `Bearer ${props.authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Failed to fetch report');

    report.value = await response.json();
    loading.value = false;
  } catch (err) {
    error.value = err.message;
    loading.value = false;
  }
};

onMounted(() => {
  fetchLiveReport();
  intervalId = setInterval(fetchLiveReport, 5000);
});

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId);
});
</script>
```

---

## Vanilla JavaScript Examples

### Simple Live Dashboard

```javascript
class LiveMatchDashboard {
  constructor(gameId, authToken, containerId) {
    this.gameId = gameId;
    this.authToken = authToken;
    this.container = document.getElementById(containerId);
    this.intervalId = null;
  }

  async fetchReport() {
    try {
      const response = await fetch(`/api/reports/live/${this.gameId}`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch report');

      const data = await response.json();
      this.render(data);
    } catch (error) {
      console.error('Error:', error);
      this.container.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
  }

  render(report) {
    const html = `
      <div class="live-dashboard">
        <div class="score">
          <h2>${report.game.home_team} ${report.game.home_score} - 
              ${report.game.away_score} ${report.game.away_team}</h2>
          <p>Period ${report.game.current_period} - ${report.game.time_remaining}</p>
        </div>
        
        <div class="shot-summary">
          ${report.shot_summary.map(team => `
            <div class="team-stats">
              <h3>${team.team_name}</h3>
              <p>FG%: ${team.fg_percentage}%</p>
              <p>Goals: ${team.goals} / ${team.total_shots}</p>
            </div>
          `).join('')}
        </div>

        <div class="top-scorers">
          <h3>Top Scorers</h3>
          <ul>
            ${report.top_scorers.map(scorer => `
              <li>#${scorer.jersey_number} ${scorer.name} - ${scorer.goals} goals</li>
            `).join('')}
          </ul>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
  }

  start() {
    this.fetchReport();
    this.intervalId = setInterval(() => this.fetchReport(), 5000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

// Usage
const dashboard = new LiveMatchDashboard(1, 'your-jwt-token', 'dashboard-container');
dashboard.start();

// Stop when leaving page
window.addEventListener('beforeunload', () => dashboard.stop());
```

---

## Error Handling Patterns

### Robust Fetch with Retry Logic

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, redirect to login
          window.location.href = '/login';
          return null;
        }
        
        if (response.status === 404) {
          throw new Error('Game not found');
        }
        
        if (response.status >= 500 && i < maxRetries - 1) {
          // Server error, retry after delay
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          continue;
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Usage
try {
  const report = await fetchWithRetry(
    `/api/reports/live/${gameId}`,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (report) {
    // Handle successful response
    console.log(report);
  }
} catch (error) {
  // Handle error
  console.error('Failed to fetch report:', error);
}
```

---

## Performance Optimization

### Caching Strategy

```javascript
class ReportCache {
  constructor(ttl = 5000) {
    this.cache = new Map();
    this.ttl = ttl; // Time to live in milliseconds
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    
    if (age > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.value;
  }

  clear() {
    this.cache.clear();
  }
}

// Usage
const reportCache = new ReportCache(5000); // 5 second cache

async function fetchLiveReportCached(gameId, authToken) {
  const cacheKey = `live-${gameId}`;
  const cached = reportCache.get(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  const response = await fetch(`/api/reports/live/${gameId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  reportCache.set(cacheKey, data);
  
  return data;
}
```

### Debounced Polling

```javascript
class DebouncedPoller {
  constructor(fetchFunction, interval = 5000) {
    this.fetchFunction = fetchFunction;
    this.interval = interval;
    this.timeoutId = null;
    this.isActive = false;
  }

  async poll() {
    if (!this.isActive) return;

    try {
      await this.fetchFunction();
    } catch (error) {
      console.error('Poll error:', error);
    }

    if (this.isActive) {
      this.timeoutId = setTimeout(() => this.poll(), this.interval);
    }
  }

  start() {
    this.isActive = true;
    this.poll();
  }

  stop() {
    this.isActive = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  setInterval(interval) {
    this.interval = interval;
  }
}

// Usage
const poller = new DebouncedPoller(
  async () => {
    const report = await fetchLiveReport(gameId, authToken);
    updateUI(report);
  },
  5000
);

poller.start();

// When user navigates away
window.addEventListener('beforeunload', () => poller.stop());
```

---

## Best Practices Summary

1. **Polling Frequency**: Poll live endpoints every 5-10 seconds to balance freshness and server load
2. **Error Handling**: Always implement retry logic and graceful degradation
3. **Caching**: Cache responses for 5 seconds to reduce unnecessary requests
4. **Cleanup**: Always clear intervals when components unmount
5. **Loading States**: Show loading indicators during data fetches
6. **Token Management**: Handle token expiration gracefully with redirects
7. **Offline Support**: Consider using service workers for offline functionality
8. **Performance**: Use debounced polling instead of setInterval for better control

---

For complete API documentation, see [REPORTS_API.md](REPORTS_API.md).
