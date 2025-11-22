# Match Reports API Documentation

This document describes the PDF report generation endpoints available in the ShotSpot API.

## Overview

The Reports API provides three types of comprehensive PDF reports for match analysis:

1. **Post-Match Summary Report** - Complete game overview with statistics and visualizations
2. **Player Performance Report** - Individual player analysis with zone-based shooting stats
3. **Coach's Analysis Report** - Tactical insights and strategic recommendations

All reports are generated as PDF documents and require authentication.

## Authentication

All endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Post-Match Summary Report

Generate a comprehensive post-match report with game statistics, scoring breakdown, and shot chart.

**Endpoint:** `GET /api/reports/games/:gameId/post-match`

**Access:** Authenticated users (any role)

**Parameters:**
- `gameId` (path, required): Integer - The game ID

**Response:**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename=post-match-report-{gameId}.pdf`

**Report Contents:**
- Game Information
  - Teams, date, final score
  - Match status and duration
- Period-by-Period Scoring
  - Score breakdown for each period
  - Running totals
- Team Statistics Comparison
  - Total shots, goals, misses, blocked
  - Field Goal Percentage (FG%)
  - Comparative analysis
- Top Performers
  - Top 5 scorers with statistics
  - Goals, shots, and FG% for each
- Key Events Timeline
  - Chronological list of important game events
  - Goals, fouls, timeouts, substitutions
- Shot Chart Visualization
  - Visual representation of all shots
  - Color-coded by result (goal/miss/blocked)
  - Court layout with shot locations

**Example Request:**
```bash
curl -X GET \
  https://api.shotspot.com/api/reports/games/123/post-match \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -o post-match-report.pdf
```

**Response Codes:**
- `200 OK` - PDF successfully generated
- `400 Bad Request` - Invalid game ID format
- `401 Unauthorized` - Missing or invalid authentication token
- `404 Not Found` - Game not found
- `500 Internal Server Error` - Server error during PDF generation

---

### 2. Player Performance Report

Generate a detailed performance report for a specific player in a game.

**Endpoint:** `GET /api/reports/games/:gameId/player/:playerId`

**Access:** Authenticated users (any role)

**Parameters:**
- `gameId` (path, required): Integer - The game ID
- `playerId` (path, required): Integer - The player ID

**Response:**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename=player-report-{playerId}-game-{gameId}.pdf`

**Report Contents:**
- Player Information
  - Name, jersey number, team
- Game Information
  - Match details, date, opponent
- Match Statistics
  - Total shots, goals, misses, blocked
  - Field Goal Percentage
  - Average shot distance
- Shooting Efficiency by Zone
  - Left zone performance
  - Center zone performance
  - Right zone performance
  - Success rate for each zone
- Substitutions
  - Times entered/exited the court
  - Period information
- Season Comparison
  - Current game vs season average FG%
  - Goals per game comparison
- Performance Notes
  - Automated insights based on statistics
  - Highlights and areas for improvement

**Example Request:**
```bash
curl -X GET \
  https://api.shotspot.com/api/reports/games/123/player/456 \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -o player-performance-report.pdf
```

**Response Codes:**
- `200 OK` - PDF successfully generated
- `400 Bad Request` - Invalid game ID or player ID format
- `401 Unauthorized` - Missing or invalid authentication token
- `404 Not Found` - Game or player not found
- `500 Internal Server Error` - Server error during PDF generation

---

### 3. Coach's Analysis Report

Generate a tactical analysis report with strategic insights and recommendations. This endpoint supports custom coach notes.

**Endpoint:** `POST /api/reports/games/:gameId/coach-analysis`

**Access:** Admin or Coach role only

**Parameters:**
- `gameId` (path, required): Integer - The game ID

**Request Body:**
```json
{
  "notes": "Optional custom notes and recommendations from the coach"
}
```

**Response:**
- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename=coach-analysis-{gameId}.pdf`

**Report Contents:**
- Game Overview
  - Match details, teams, final score
- Tactical Insights
  - **Possession Statistics**
    - Total possessions per team
    - Average possession duration
    - Average shots per possession
    - Possessions ending in goals
    - Turnovers
  - **Timeout Usage**
    - Timeouts used by period
    - Strategic timing analysis
- Substitution Patterns Analysis
  - Substitutions by period
  - Reasons for substitutions (tactical, injury, fatigue, disciplinary)
  - Pattern analysis
- Period-by-Period Momentum Analysis
  - Scoring trends per period
  - Field Goal Percentage changes
  - Shot volume analysis
- Opponent Analysis
  - Strengths identified
    - High shooting efficiency
    - High shot volume
  - Weaknesses identified
    - Low shooting efficiency
    - High blocked shots
- Recommendations & Notes
  - Custom coach notes (from request body)
  - Strategic recommendations

**Example Request:**
```bash
curl -X POST \
  https://api.shotspot.com/api/reports/games/123/coach-analysis \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json' \
  -d '{
    "notes": "Excellent defensive performance in the second half. Focus on maintaining possession time and reducing turnovers in the next match."
  }' \
  -o coach-analysis-report.pdf
```

**Response Codes:**
- `200 OK` - PDF successfully generated
- `400 Bad Request` - Invalid game ID format or invalid notes type
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - User does not have admin or coach role
- `404 Not Found` - Game not found
- `500 Internal Server Error` - Server error during PDF generation

---

## Error Responses

All endpoints return JSON error responses in the following format when not returning PDF:

```json
{
  "error": "Error message",
  "errors": [
    {
      "msg": "Detailed validation error",
      "param": "field_name",
      "location": "body"
    }
  ]
}
```

## Rate Limiting

Report generation endpoints are subject to the same rate limiting as other API endpoints:
- 100 requests per 15-minute window in production
- No rate limiting in development mode

## Security Considerations

- All endpoints require valid JWT authentication
- Coach's Analysis Report requires elevated permissions (admin/coach role)
- Reports may contain sensitive team and player data
- PDFs are generated on-demand and not cached
- Large games may take several seconds to generate reports

## Best Practices

1. **Caching:** Consider caching PDF reports on the client side to reduce server load
2. **Timing:** Generate reports after games are completed for most accurate data
3. **File Naming:** Use the provided filename from `Content-Disposition` header for consistency
4. **Error Handling:** Implement proper error handling for timeout scenarios on large games
5. **User Experience:** Show a loading indicator while reports are being generated

## Dependencies

The Reports API uses the following technologies:
- **pdfkit** - PDF generation library
- **express-validator** - Input validation
- **PostgreSQL** - Database queries for statistics

## Future Enhancements

Planned improvements for future versions:
- Customizable report templates
- Multiple language support
- Chart and graph customization options
- Email delivery of reports
- Batch report generation for multiple games
- Export to other formats (Excel, CSV, JSON)
