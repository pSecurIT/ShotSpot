# Advanced Analytics for Reports

This document describes the advanced analytics features available in ShotSpot, including performance predictions, benchmarking, and video integration capabilities.

## Overview

The advanced analytics system extends ShotSpot's reporting capabilities with three major feature areas:

1. **Performance Predictions**: AI-based next-game predictions, player form trends, and fatigue indicators
2. **Benchmarking**: League/competition averages, position-based comparisons, and historical performance benchmarks
3. **Video Integration**: Link report events to video timestamps, highlight reel generation, and tagged video clips for PDF reports

## API Endpoints

All endpoints require authentication. Most read endpoints are available to all authenticated users, while write endpoints (video linking) require admin or coach roles.

Base path: `/api/advanced-analytics`

### Performance Predictions

#### Get Player Form Trends

Analyzes recent performance to identify improving/declining trends.

```
GET /predictions/form-trends/:playerId?games=5
```

**Parameters:**
- `playerId` (path, required): Player ID
- `games` (query, optional): Number of recent games to analyze (3-20, default: 5)

**Response:**
```json
{
  "player_id": 123,
  "form_trend": "improving",
  "trend_change": 7.5,
  "recent_avg_fg": 65.5,
  "older_avg_fg": 58.0,
  "overall_avg_fg": 62.3,
  "volatility": 12.5,
  "consistency_rating": "medium",
  "games_analyzed": 5,
  "recent_games": [...]
}
```

**Form Trend Values:**
- `hot`: Recent performance significantly above average (>15% improvement)
- `improving`: Performance trending upward (5-15% improvement)
- `stable`: Consistent performance (±5%)
- `declining`: Performance trending downward (5-15% decline)
- `cold`: Recent performance significantly below average (>15% decline)
- `insufficient_data`: Need at least 3 games for analysis

#### Get Player Fatigue Indicators

Analyzes play time and performance degradation across periods.

```
GET /predictions/fatigue/:playerId?game_id=456
```

**Parameters:**
- `playerId` (path, required): Player ID
- `game_id` (query, optional): Specific game ID (defaults to last 5 games)

**Response:**
```json
{
  "player_id": 123,
  "games_analyzed": 2,
  "fatigue_analysis": [
    {
      "game_id": 456,
      "game_date": "2024-01-15T18:00:00Z",
      "play_time_seconds": 2100,
      "play_time_minutes": 35.0,
      "play_time_percent": 87.5,
      "performance_degradation": 12.5,
      "fatigue_level": "tired",
      "period_performance": [...]
    }
  ]
}
```

**Fatigue Levels:**
- `fresh`: < 40% play time
- `normal`: 40-70% play time with minimal degradation
- `tired`: 70-85% play time or moderate degradation (10-15%)
- `exhausted`: > 85% play time or significant degradation (>15%)

#### Get Next Game Prediction

AI-based prediction for next game performance using statistical models.

```
GET /predictions/next-game/:playerId?opponent_id=789
```

**Parameters:**
- `playerId` (path, required): Player ID
- `opponent_id` (query, optional): Opponent team ID for matchup-specific prediction

**Response:**
```json
{
  "player_id": 123,
  "opponent_id": 789,
  "predicted_fg_percentage": 68.5,
  "predicted_shots": 9,
  "predicted_goals": 6,
  "confidence_score": 82.5,
  "form_trend": "improving",
  "historical_avg": {
    "fg_percentage": 62.3,
    "shots_per_game": 8.5,
    "goals_per_game": 5.3
  },
  "adjustments": {
    "form_adjustment": 5,
    "matchup_adjustment": 1.2
  }
}
```

### Benchmarking

#### Get League/Competition Averages

Calculate aggregate statistics across games for benchmarking.

```
GET /benchmarks/league-averages?competition=default&season=current&position=all
```

**Parameters:**
- `competition` (query, optional): Competition name (default: "default")
- `season` (query, optional): Season identifier (default: "current")
- `position` (query, optional): Player position filter - "offense", "defense", or "all" (default: "all")
- `min_games` (query, optional): Minimum games played (default: 3)

**Response:**
```json
{
  "competition": "default",
  "season": "current",
  "position": "all",
  "league_averages": {
    "total_games": 25,
    "total_players": 45,
    "avg_shots_per_game": 7.5,
    "avg_goals_per_game": 4.2,
    "avg_fg_percentage": 56.0,
    "avg_shot_distance": 5.8
  },
  "position_averages": {
    "position": "offense",
    "total_players": 25,
    "avg_shots_per_game": 8.2,
    "avg_goals_per_game": 4.8,
    "avg_fg_percentage": 58.5
  }
}
```

#### Compare Player to League Averages

Compare individual player statistics against league benchmarks.

```
GET /benchmarks/player-comparison/:playerId?games=10
```

**Parameters:**
- `playerId` (path, required): Player ID
- `games` (query, optional): Number of recent games to analyze (1-50, default: 10)

**Response:**
```json
{
  "player_id": 123,
  "games_analyzed": 10,
  "player_stats": {
    "avg_shots_per_game": 9.2,
    "avg_goals_per_game": 6.1,
    "avg_fg_percentage": 66.3,
    "avg_shot_distance": 5.5
  },
  "league_averages": {
    "avg_shots_per_game": 7.5,
    "avg_goals_per_game": 4.2,
    "avg_fg_percentage": 56.0,
    "avg_shot_distance": 5.8
  },
  "comparison": {
    "shots_vs_league": 22.67,
    "goals_vs_league": 45.24,
    "fg_vs_league": 10.3,
    "distance_vs_league": -0.3
  },
  "percentile_rank": {
    "fg_percentage": 78.5
  }
}
```

Percentage values in `comparison` show how much better (+) or worse (-) the player performs vs league average.

#### Get Historical Performance Benchmarks

Retrieve historical statistics for players or teams across different time periods.

```
GET /benchmarks/historical/:entityType/:entityId?periods[]=last_7_days&periods[]=last_30_days
```

**Parameters:**
- `entityType` (path, required): "player" or "team"
- `entityId` (path, required): Player ID or Team ID
- `periods` (query, optional): Array of time periods (default: ["last_7_days", "last_30_days", "season"])

**Available Periods:**
- `last_7_days`: Last 7 days
- `last_30_days`: Last 30 days
- `last_90_days`: Last 90 days
- `season`: Last 365 days

**Response:**
```json
{
  "entity_type": "player",
  "entity_id": 123,
  "historical_benchmarks": [
    {
      "period": "last_7_days",
      "games_played": 2,
      "total_shots": 18,
      "total_goals": 12,
      "avg_fg_percentage": 66.67,
      "avg_distance": 5.5,
      "avg_shots_per_game": 9.0,
      "avg_goals_per_game": 6.0
    },
    {
      "period": "last_30_days",
      "games_played": 5,
      "total_shots": 45,
      "total_goals": 28,
      "avg_fg_percentage": 62.22,
      "avg_distance": 5.7,
      "avg_shots_per_game": 9.0,
      "avg_goals_per_game": 5.6
    }
  ]
}
```

### Video Integration

#### Link Event to Video Timestamp

Link a game event to a specific timestamp in a video file. Requires admin or coach role.

```
POST /video/link-event
```

**Request Body:**
```json
{
  "game_id": 456,
  "event_type": "goal",
  "event_id": 789,
  "video_url": "https://example.com/game.mp4",
  "timestamp_start": 120,
  "timestamp_end": 130,
  "description": "Amazing goal by player",
  "is_highlight": true,
  "tags": ["goal", "highlight", "team1"]
}
```

**Fields:**
- `game_id` (required): Game ID
- `event_type` (required): Type of event (e.g., "goal", "shot", "substitution", "timeout")
- `event_id` (optional): Reference ID to specific event in related table
- `video_url` (optional): URL or path to video file
- `timestamp_start` (required): Start time in seconds
- `timestamp_end` (optional): End time in seconds
- `description` (optional): Description of the event
- `is_highlight` (optional): Mark as highlight for reel generation (default: false)
- `tags` (optional): Array of tags for categorization

**Response:**
```json
{
  "id": 123,
  "game_id": 456,
  "event_type": "goal",
  "event_id": 789,
  "video_url": "https://example.com/game.mp4",
  "timestamp_start": 120,
  "timestamp_end": 130,
  "description": "Amazing goal by player",
  "is_highlight": true,
  "tags": ["goal", "highlight", "team1"],
  "created_at": "2024-01-15T18:00:00Z",
  "updated_at": "2024-01-15T18:00:00Z"
}
```

#### Get Video Events for Game

Retrieve all video-linked events for a specific game.

```
GET /video/game/:gameId?event_type=goal&highlights_only=true
```

**Parameters:**
- `gameId` (path, required): Game ID
- `event_type` (query, optional): Filter by event type
- `highlights_only` (query, optional): Return only highlighted events (default: false)

**Response:**
```json
[
  {
    "id": 123,
    "game_id": 456,
    "event_type": "goal",
    "event_id": 789,
    "timestamp_start": 120,
    "timestamp_end": 130,
    "is_highlight": true,
    "tags": ["goal", "highlight"]
  }
]
```

#### Generate Highlight Reel Metadata

Automatically identify key moments for highlight reel generation.

```
GET /video/highlights/:gameId?max_clips=20
```

**Parameters:**
- `gameId` (path, required): Game ID
- `max_clips` (query, optional): Maximum number of clips (1-50, default: 20)

**Response:**
```json
{
  "game_id": 456,
  "total_clips": 15,
  "marked_highlights": [
    {
      "id": 123,
      "event_type": "goal",
      "timestamp_start": 120,
      "is_highlight": true
    }
  ],
  "auto_identified_highlights": [
    {
      "event_id": 456,
      "event_type": "goal",
      "description": "Goal by Alice AdvPlayer (Adv Analytics Team 1)",
      "suggested_duration": 10,
      "priority": "high"
    }
  ],
  "reel_metadata": {
    "suggested_total_duration": 180,
    "clip_ordering": "chronological",
    "include_transitions": true
  }
}
```

The system automatically identifies goals as highlights when there aren't enough manually marked highlights.

#### Get Video Data for PDF Reports

Retrieve all video-tagged events formatted for inclusion in PDF reports.

```
GET /video/report-data/:gameId
```

**Parameters:**
- `gameId` (path, required): Game ID

**Response:**
```json
{
  "game_id": 456,
  "video_events": [
    {
      "id": 123,
      "event_type": "goal",
      "timestamp_start": 120,
      "event_details": {
        "player_name": "Alice AdvPlayer",
        "team_name": "Adv Analytics Team 1",
        "result": "goal",
        "x_coord": 10.0,
        "y_coord": 50.0
      }
    }
  ],
  "report_metadata": {
    "includes_video_links": true,
    "total_tagged_events": 5,
    "highlights_count": 3,
    "event_types": ["goal", "shot", "substitution"]
  }
}
```

## Database Schema

The advanced analytics features use the following new database tables:

### video_events

Stores links between game events and video timestamps.

```sql
CREATE TABLE video_events (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id),
    event_type VARCHAR(50) NOT NULL,
    event_id INTEGER,
    video_url TEXT,
    timestamp_start INTEGER NOT NULL,
    timestamp_end INTEGER,
    description TEXT,
    is_highlight BOOLEAN DEFAULT false,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### player_predictions

Stores AI-based predictions and analysis results.

```sql
CREATE TABLE player_predictions (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    game_id INTEGER REFERENCES games(id),
    prediction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    prediction_type VARCHAR(50) NOT NULL,
    predicted_fg_percentage DECIMAL(5,2),
    predicted_goals INTEGER,
    predicted_shots INTEGER,
    confidence_score DECIMAL(5,2),
    form_trend VARCHAR(20),
    fatigue_level VARCHAR(20),
    factors JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### competition_benchmarks

Stores league and competition average statistics.

```sql
CREATE TABLE competition_benchmarks (
    id SERIAL PRIMARY KEY,
    competition_name VARCHAR(100) NOT NULL,
    season VARCHAR(20),
    position VARCHAR(20),
    benchmark_type VARCHAR(50) NOT NULL,
    benchmark_value DECIMAL(10,2) NOT NULL,
    sample_size INTEGER,
    calculation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### historical_performance

Stores historical performance metrics for comparison.

```sql
CREATE TABLE historical_performance (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(20) NOT NULL,
    entity_id INTEGER NOT NULL,
    time_period VARCHAR(50) NOT NULL,
    games_played INTEGER NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    calculation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Usage Examples

### Generating a Complete Pre-Game Report

```javascript
// 1. Get player predictions
const formTrends = await fetch(`/api/advanced-analytics/predictions/form-trends/${playerId}`);
const fatigue = await fetch(`/api/advanced-analytics/predictions/fatigue/${playerId}`);
const prediction = await fetch(`/api/advanced-analytics/predictions/next-game/${playerId}?opponent_id=${opponentId}`);

// 2. Get benchmarking data
const comparison = await fetch(`/api/advanced-analytics/benchmarks/player-comparison/${playerId}`);
const historical = await fetch(`/api/advanced-analytics/benchmarks/historical/player/${playerId}`);

// Generate comprehensive pre-game report with all data
```

### Creating a Post-Game Report with Video Highlights

```javascript
// 1. Link important events to video
await fetch('/api/advanced-analytics/video/link-event', {
  method: 'POST',
  body: JSON.stringify({
    game_id: gameId,
    event_type: 'goal',
    event_id: shotId,
    timestamp_start: 120,
    is_highlight: true,
    tags: ['goal', 'highlight']
  })
});

// 2. Generate highlight reel
const highlights = await fetch(`/api/advanced-analytics/video/highlights/${gameId}`);

// 3. Get report data with video links
const reportData = await fetch(`/api/advanced-analytics/video/report-data/${gameId}`);

// Generate PDF report with embedded video timestamps
```

### Monitoring Team Performance Trends

```javascript
// Get league averages for comparison
const leagueAvg = await fetch('/api/advanced-analytics/benchmarks/league-averages?position=offense');

// Compare each player
for (const player of players) {
  const comparison = await fetch(`/api/advanced-analytics/benchmarks/player-comparison/${player.id}`);
  const historical = await fetch(`/api/advanced-analytics/benchmarks/historical/player/${player.id}`);
  
  // Identify players performing above/below league average
  // Track trends over time
}
```

## Security Considerations

- All endpoints require authentication
- Video linking (POST endpoints) requires admin or coach role
- Input validation on all parameters
- Rate limiting applies to all requests
- CSRF protection enabled

## Performance Notes

- Predictions are cached in the database after calculation
- League averages should be recalculated periodically (e.g., nightly)
- Historical benchmarks are stored to avoid recalculation
- Complex queries may take longer for large datasets

## Future Enhancements

- Machine learning models for more accurate predictions
- Video clip extraction and automatic highlight compilation
- Real-time fatigue monitoring during games
- Advanced scouting reports combining all analytics
- Position-specific benchmarking refinements
- Integration with external video platforms
