# Data Visualization Features

This document describes the interactive visualization features available in ShotSpot for analyzing match performance.

## Overview

ShotSpot provides advanced data visualization capabilities to help coaches and analysts understand match dynamics, player performance, and team strategies through interactive charts and diagrams.

## Features

### 1. Interactive Shot Chart 🎨

The Interactive Shot Chart provides a visual representation of all shots taken during a match, overlaid on a korfball court image.

**Key Features:**
- **Clickable Zones**: The court is divided into 9 zones (3x3 grid) that can be clicked to filter shots and view zone-specific statistics
- **Hover Tooltips**: Hover over any shot marker to see detailed information including player name, shot type, distance, and period
- **Zone Statistics**: View shot count, goals, success rate for each zone
- **Shot Markers**: Color-coded markers (green=goal, red=miss, orange=blocked)
- **Zone Overlay Toggle**: Show/hide the zone grid overlay

**Export Options:**
- Export as PNG image
- Export as SVG vector graphic
- Generate shareable links with current filter state

**Usage:**
```typescript
<InteractiveShotChart
  shots={shotData}
  title="Interactive Shot Chart"
  showZones={true}
  showExportButtons={true}
  onZoneClick={(zoneId) => console.log('Zone clicked:', zoneId)}
/>
```

**Navigation:**
In the ShotAnalytics page, click the "🎨 Interactive" tab to access this view.

---

### 2. Player Comparison Radar Charts 👥

Compare up to 4 players simultaneously using multi-dimensional radar charts.

**Key Features:**
- **Multi-Player Overlay**: Compare 2-4 players on the same radar chart
- **Customizable Metrics**: Select which metrics to display
  - Accuracy (Field Goal %)
  - Volume (Shot Attempts)
  - Left Zone Success Rate
  - Center Zone Success Rate
  - Right Zone Success Rate
  - Average Shot Distance
- **Detailed Statistics Table**: View exact numbers for all players
- **Visual Comparison**: Larger area indicates better overall performance

**Export Options:**
- Export comparison chart as PNG
- Generate shareable links with selected players

**Usage:**
```typescript
<PlayerComparisonRadar
  players={selectedPlayers}
  availablePlayers={allPlayers}
  onPlayerSelect={(playerId) => addPlayer(playerId)}
  onPlayerRemove={(playerId) => removePlayer(playerId)}
  maxPlayers={4}
/>
```

**Navigation:**
In the ShotAnalytics page, click the "👥 Compare" tab to access this view.

---

### 3. Possession Flow Diagram 🔄

Visualize team possession patterns throughout the match with two different views.

**Key Features:**

**Timeline View:**
- Shows possession blocks in chronological order
- Block height indicates possession duration
- Color-coded by team (blue=home, orange=away)
- Icons show possession result (⚽=goal, 🔄=turnover, ⏹️=period end)

**Flow View:**
- Shows possession sequences horizontally
- Block width represents duration
- Easier to see back-and-forth patterns

**Statistics Panel:**
- Possession count per team
- Time of possession percentage
- Average possession duration
- Total shots per team
- Visual possession bar showing percentage split

**Filters:**
- Filter by period
- View mode toggle (Timeline/Flow)

**Export Options:**
- Export diagram as PNG
- Generate shareable links with filters

**Usage:**
```typescript
<PossessionFlowDiagram
  possessions={possessionData}
  homeTeamId={1}
  awayTeamId={2}
  homeTeamName="Team A"
  awayTeamName="Team B"
  currentPeriod={1}
  showExportButtons={true}
/>
```

**Navigation:**
In the ShotAnalytics page, click the "🔄 Possession" tab to access this view.

---

## Accessing Visualizations

All visualization features are accessible from the **Shot Analytics** page:

1. Navigate to a match
2. Click on "📊 Shot Analytics" in the navigation
3. Select the desired visualization tab:
   - 🎨 Interactive - Interactive shot chart with zones
   - 👥 Compare - Player comparison radar charts
   - 🔄 Possession - Possession flow diagrams

## Export Functionality

All visualizations support multiple export formats:

### PNG Export
- High-quality image export using html2canvas
- Suitable for presentations and reports
- Click the "📷 PNG" button to download

### SVG Export
- Vector graphics format (where supported)
- Scalable without quality loss
- Click the "🎨 SVG" button to download

### Shareable Links
- Generate URLs that preserve your current view and filters
- Share specific analyses with team members
- Click the "🔗 Share" button to copy link to clipboard

## Technical Details

### Dependencies
- **recharts**: React charting library for radar charts
- **html2canvas**: PNG image generation
- **React 19**: Latest React features and optimizations

### Components
- `InteractiveShotChart.tsx` - Shot chart with clickable zones
- `PlayerComparisonRadar.tsx` - Multi-player radar comparison
- `PossessionFlowDiagram.tsx` - Possession flow visualization

### Styling
- `InteractiveShotChart.css` - Shot chart styles
- `PlayerComparisonRadar.css` - Radar chart styles
- `PossessionFlowDiagram.css` - Flow diagram styles

## Best Practices

### Performance
- Visualizations are optimized for up to 500 shots per match
- Use period filters to reduce data load for long matches
- Export functions are debounced to prevent multiple rapid exports

### Mobile Responsiveness
- All visualizations are responsive and work on tablets
- Touch-friendly interfaces for mobile devices
- Simplified views on smaller screens

### Accessibility
- Color-coded markers with symbols (not just color)
- Keyboard navigation support
- Screen reader compatible labels

## Troubleshooting

### Visualizations Not Loading
1. Ensure match data is available
2. Check browser console for errors
3. Try refreshing the analytics page

### Export Not Working
1. Check browser popup blocker settings
2. Ensure sufficient browser storage
3. Try a different export format

### Performance Issues
1. Filter by period to reduce data volume
2. Close other browser tabs
3. Clear browser cache and reload

## Future Enhancements

Planned improvements include:
- PDF report generation with embedded charts
- Animation of possession flows over time
- Advanced filtering options (player, shot type, etc.)
- Custom zone definitions
- Comparison of multiple matches
- Team tendency analysis over seasons

## Support

For issues or feature requests related to visualizations:
1. Check this documentation first
2. Review the QUICKSTART.md and INSTALLATION.md guides
3. Open an issue on the GitHub repository
4. Include screenshots when reporting visualization bugs

---

**Last Updated:** November 2025
**Version:** 1.0.0
