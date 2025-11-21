# Real-Time Match Reports API Documentation

This document describes the new real-time match reporting endpoints added to the ShotSpot API.

## Overview

The Reports API provides comprehensive live match reporting capabilities including:
- Real-time game state snapshots
- Period-by-period analytics
- Momentum tracking
- Player comparison tools
- Substitution suggestions
- Downloadable game reports

All endpoints require authentication via Bearer token in the Authorization header.

## Endpoints

### 1. Live Match Dashboard

**GET** `/api/reports/live/:gameId`

Returns a comprehensive snapshot of the current game state including scores, shot summary, recent events, and top scorers.

**Parameters:**
- `gameId` (path, integer, required) - The unique identifier of the game

**Response:**
```json
{
  "game": {
    "id": 1,
    "home_team": "Team A",
    "away_team": "Team B",
    "home_score": 15,
    "away_score": 12,
    "status": "in_progress",
    "current_period": 2,
    "time_remaining": "00:05:30",
    "timer_state": "running",
    "date": "2024-11-21T18:00:00Z"
  },
  "shot_summary": [
    {
      "team_id": 1,
      "team_name": "Team A",
      "total_shots": 25,
      "goals": 15,
      "misses": 8,
      "blocked": 2,
      "fg_percentage": 60.0
    },
    {
      "team_id": 2,
      "team_name": "Team B",
      "total_shots": 22,
      "goals": 12,
      "misses": 7,
      "blocked": 3,
      "fg_percentage": 54.55
    }
  ],
  "recent_events": [
    {
      "id": 15,
      "event_type": "timeout",
      "team_name": "Team A",
      "player_name": null,
      "period": 2,
      "time_remaining": "00:05:30",
      "created_at": "2024-11-21T18:25:00Z"
    }
  ],
  "top_scorers": [
    {
      "player_id": 5,
      "name": "Alice Johnson",
      "jersey_number": 10,
      "team_name": "Team A",
      "goals": 8,
      "total_shots": 12
    }
  ],
  "generated_at": "2024-11-21T18:30:00Z"
}
```

**Use Cases:**
- Display on live scoreboards
- Coach tablets during matches
- Streaming overlays
- Mobile app live updates

---

### 2. Period Report

**GET** `/api/reports/period/:gameId/:period`

Generates detailed statistics for a specific period of the game.

**Parameters:**
- `gameId` (path, integer, required) - The unique identifier of the game
- `period` (path, integer, required) - The period number (minimum 1)

**Response:**
```json
{
  "game_id": 1,
  "period": 1,
  "team_stats": [
    {
      "team_id": 1,
      "team_name": "Team A",
      "total_shots": 12,
      "goals": 7,
      "misses": 4,
      "blocked": 1,
      "fg_percentage": 58.33,
      "avg_distance": 5.5
    }
  ],
  "events": [
    {
      "id": 5,
      "event_type": "foul",
      "team_name": "Team B",
      "player_name": "Bob Smith",
      "period": 1,
      "time_remaining": "00:08:00"
    }
  ],
  "player_stats": [
    {
      "player_id": 5,
      "name": "Alice Johnson",
      "jersey_number": 10,
      "team_name": "Team A",
      "shots": 6,
      "goals": 4,
      "fg_percentage": 66.67
    }
  ],
  "generated_at": "2024-11-21T18:30:00Z"
}
```

**Use Cases:**
- Post-period analysis
- Half-time reports
- Period-by-period comparison
- Player performance tracking

---

### 3. Momentum Tracker

**GET** `/api/reports/momentum/:gameId`

Calculates real-time momentum based on recent shot performance.

**Parameters:**
- `gameId` (path, integer, required) - The unique identifier of the game
- `window` (query, integer, optional) - Number of recent shots to analyze (5-20, default: 10)

**Algorithm:**
- Goals: +3 points
- Misses: -1 point
- Blocked shots: -2 points
- Recent shots weighted more heavily
- Normalized to -100 to +100 scale

**Response:**
```json
{
  "window_size": 10,
  "recent_shots_analyzed": 10,
  "momentum": {
    "home": 45,
    "away": -20,
    "trend": "home"
  },
  "recent_shots": [
    {
      "team_name": "Team A",
      "result": "goal",
      "time": "2024-11-21T18:28:00Z"
    }
  ]
}
```

**Use Cases:**
- Live momentum graphs
- Coaching decisions
- Timeout timing
- Substitution planning

---

### 4. Player Comparison

**GET** `/api/reports/compare/:gameId/:playerId1/:playerId2`

Compares two players' performance in the current game.

**Parameters:**
- `gameId` (path, integer, required) - The unique identifier of the game
- `playerId1` (path, integer, required) - First player's ID
- `playerId2` (path, integer, required) - Second player's ID

**Response:**
```json
{
  "game_id": 1,
  "players": [
    {
      "player_id": 5,
      "name": "Alice Johnson",
      "jersey_number": 10,
      "team_name": "Team A",
      "total_shots": 12,
      "goals": 8,
      "misses": 3,
      "blocked": 1,
      "fg_percentage": 66.67,
      "avg_distance": 5.5,
      "zone_distribution": {
        "left": 4,
        "center": 5,
        "right": 3
      }
    },
    {
      "player_id": 7,
      "name": "Bob Smith",
      "jersey_number": 12,
      "team_name": "Team A",
      "total_shots": 10,
      "goals": 5,
      "misses": 4,
      "blocked": 1,
      "fg_percentage": 50.0,
      "avg_distance": 6.2,
      "zone_distribution": {
        "left": 2,
        "center": 6,
        "right": 2
      }
    }
  ],
  "comparison_summary": {
    "goals_leader": "Alice Johnson",
    "fg_percentage_leader": "Alice Johnson",
    "shots_leader": "Alice Johnson"
  }
}
```

**Use Cases:**
- Tactical analysis
- Player matchup evaluation
- Performance benchmarking
- Coaching decisions

---

### 5. Substitution Suggestions

**GET** `/api/reports/suggestions/substitution/:gameId`

Generates data-driven substitution suggestions based on player performance.

**Parameters:**
- `gameId` (path, integer, required) - The unique identifier of the game
- `team_id` (query, integer, optional) - Filter suggestions for specific team

**Suggestion Criteria:**
- Field goal percentage < 30% with 5+ shots: Medium priority
- No shots attempted: Low priority
- Future: Fatigue metrics, defensive performance

**Response:**
```json
{
  "game_id": 1,
  "suggestions": [
    {
      "player_id": 7,
      "name": "Bob Smith",
      "jersey_number": 12,
      "team_name": "Team A",
      "reason": "Low field goal percentage",
      "current_fg": 20.0,
      "shots_taken": 10,
      "priority": "medium"
    }
  ],
  "total_suggestions": 1
}
```

**Use Cases:**
- Real-time coaching assistance
- Strategic substitution planning
- Performance monitoring
- Player rest management

---

### 6. Export Game Report

**GET** `/api/reports/export/:gameId`

Exports comprehensive game data in downloadable format.

**Parameters:**
- `gameId` (path, integer, required) - The unique identifier of the game
- `format` (query, string, optional) - Export format: `json` (default) or `summary`

**Response (format=json):**
```json
{
  "export_date": "2024-11-21T18:30:00Z",
  "game": {
    "id": 1,
    "date": "2024-11-21T18:00:00Z",
    "status": "in_progress",
    "home_team": {
      "id": 1,
      "name": "Team A",
      "score": 15
    },
    "away_team": {
      "id": 2,
      "name": "Team B",
      "score": 12
    },
    "current_period": 2,
    "time_remaining": "00:05:30",
    "period_duration": "00:10:00",
    "number_of_periods": 4
  },
  "shots": [
    {
      "id": 1,
      "player_id": 5,
      "first_name": "Alice",
      "last_name": "Johnson",
      "jersey_number": 10,
      "team_name": "Team A",
      "x_coord": 45.5,
      "y_coord": 52.3,
      "result": "goal",
      "period": 1,
      "time_remaining": "00:08:15",
      "shot_type": "jump shot",
      "distance": 5.5
    }
  ],
  "events": [],
  "player_statistics": [
    {
      "player_id": 5,
      "name": "Alice Johnson",
      "jersey_number": 10,
      "team_name": "Team A",
      "total_shots": 12,
      "goals": 8,
      "misses": 3,
      "blocked": 1,
      "fg_percentage": 66.67
    }
  ]
}
```

**Response (format=summary):**
```json
{
  "export_date": "2024-11-21T18:30:00Z",
  "game": {
    "id": 1,
    "date": "2024-11-21T18:00:00Z",
    "status": "in_progress",
    "home_team": { "id": 1, "name": "Team A", "score": 15 },
    "away_team": { "id": 2, "name": "Team B", "score": 12 },
    "current_period": 2,
    "time_remaining": "00:05:30",
    "period_duration": "00:10:00",
    "number_of_periods": 4
  },
  "summary": {
    "total_shots": 47,
    "total_goals": 27,
    "total_events": 8,
    "top_scorer": {
      "name": "Alice Johnson",
      "goals": 8
    }
  }
}
```

**Headers:**
- `Content-Type`: `application/json`
- `Content-Disposition`: `attachment; filename="game-{gameId}-report.json"`

**Use Cases:**
- Post-game analysis
- Record keeping
- Statistical analysis
- Report sharing
- Email attachments

---

## Authentication

All endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Error Responses

### 400 Bad Request
```json
{
  "errors": [
    {
      "msg": "Game ID must be an integer",
      "param": "gameId",
      "location": "params"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

### 404 Not Found
```json
{
  "error": "Game not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to generate live report"
}
```

## Rate Limiting

These endpoints are subject to the standard API rate limit:
- 5000 requests per 15 minutes in production
- Unlimited in development mode

## Best Practices

1. **Polling Frequency**: For live updates, poll the `/live/:gameId` endpoint every 5-10 seconds
2. **Momentum Window**: Use window size 10-15 for balanced momentum tracking
3. **Export Format**: Use `summary` format for quick sharing, `json` for detailed analysis
4. **Period Reports**: Generate after period ends for accurate statistics
5. **Caching**: Client-side cache reports for 5 seconds to reduce server load

## Integration Examples

### JavaScript/Fetch
```javascript
// Get live match report
const response = await fetch(`/api/reports/live/${gameId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const report = await response.json();
```

### React Hook
```javascript
const useLiveReport = (gameId) => {
  const [report, setReport] = useState(null);
  
  useEffect(() => {
    const fetchReport = async () => {
      const response = await fetch(`/api/reports/live/${gameId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setReport(data);
    };
    
    fetchReport();
    const interval = setInterval(fetchReport, 5000); // Poll every 5s
    
    return () => clearInterval(interval);
  }, [gameId]);
  
  return report;
};
```

### Download Report
```javascript
const downloadReport = async (gameId) => {
  const response = await fetch(`/api/reports/export/${gameId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `game-${gameId}-report.json`;
  a.click();
};
```

## Future Enhancements

Planned features for future releases:
- CSV export format
- PDF report generation
- Email sharing integration
- WebSocket support for real-time updates
- Advanced momentum algorithms (including defensive stats)
- Fatigue tracking in substitution suggestions
- Custom report templates
- Multi-game aggregation

## Support

For issues or questions about the Reports API, please contact the development team or file an issue in the GitHub repository.
