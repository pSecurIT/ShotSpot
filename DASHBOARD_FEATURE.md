# Real-time Game Dashboard Feature

## Overview
The Live Dashboard provides coaches with comprehensive real-time statistics during korfball matches, enabling data-driven decision making and enhanced game analysis.

## Features

### 1. Live Statistics Panel
- **Real-time Updates**: Automatically refreshes statistics every 10 seconds when the match timer is running
- **Live Indicator**: Visual "🔴 LIVE" badge shows when statistics are actively updating
- **Responsive Design**: Optimized for tablets and mobile devices used courtside

### 2. Score Tracking
- **Period-by-Period Breakdown**: Shows scores for each period in a clear, tabular format
- **Current Period Highlighting**: Visual emphasis on the active period for quick reference
- **Total Scores**: Displays cumulative scores for both teams
- **Team Color Coding**: Home team (blue) and away team (pink) for easy differentiation

### 3. Performance Metrics

#### Shooting Percentage
- Calculates real-time field goal percentage (goals/total shots)
- Displays for both teams side-by-side
- Shows detailed shot counts (e.g., "5/10 shots")

#### Shot Distribution
- Visual breakdown of shot outcomes:
  - ⚽ Goals (successful shots)
  - ❌ Misses (unsuccessful attempts)
  - 🚫 Blocked shots (defensive stops)
- Color-coded badges for quick scanning

#### Possession Statistics
- Total possession count per team
- Average possession duration (formatted as MM:SS)
- Helps analyze team control and tempo

#### Shots per Possession
- Efficiency metric showing offensive effectiveness
- Calculated as total shots divided by completed possessions
- Higher values indicate more aggressive offensive play

### 4. Enhanced Timer Integration
- Dashboard automatically responds to timer state changes
- Statistics update when periods transition
- Seamless integration with existing timer controls

## Technical Implementation

### Component Architecture
```
LiveMatch (parent)
  └── LiveDashboard
      ├── Period Breakdown Section
      ├── Performance Metrics Section
      │   ├── Shooting Percentage Card
      │   ├── Shot Distribution Card
      │   ├── Possession Statistics Card
      │   └── Shots per Possession Card
      └── Auto-refresh Logic
```

### Data Sources
The dashboard fetches data from existing API endpoints:
- `/shots/:gameId` - Shot data for shooting percentages and distribution
- `/possessions/:gameId` - Possession timing and counts
- No new backend endpoints required

### State Management
- Uses React hooks (useState, useEffect, useCallback)
- Memoized fetch functions to prevent unnecessary re-renders
- Optimistic loading states for smooth UX

### Styling Approach
- CSS Grid for responsive metric cards
- Flexbox for component layouts
- CSS custom properties (variables) for consistent theming
- Mobile-first responsive design (breakpoints at 768px and 480px)

## Usage

### For Coaches
1. Navigate to a live match
2. The dashboard appears automatically below the scoreboard
3. Statistics update in real-time as events are recorded
4. Use metrics to make informed substitution and strategy decisions

### Viewing Options
- **Desktop/Tablet**: Full dashboard with all metrics visible
- **Mobile**: Stacked layout for easy scrolling
- **Focus Mode**: Dashboard is replaced by simplified court view

## Testing

### Automated Tests
- 13 comprehensive test cases
- 100% coverage of core functionality
- Tests for edge cases (zero shots, API errors)
- Performance and state management validation

### Test Categories
1. **Rendering Tests**: Component displays correctly
2. **Calculation Tests**: Statistics computed accurately
3. **Integration Tests**: Data fetching and state updates
4. **Error Handling**: Graceful failure scenarios
5. **Responsive Tests**: Layout adaptations

## Performance Considerations

### Optimization Strategies
1. **Debounced Refresh**: 10-second interval prevents excessive API calls
2. **Conditional Updates**: Only refreshes when timer is running
3. **Memoized Callbacks**: Prevents unnecessary re-renders
4. **Lazy Loading**: Dashboard only loads when needed

### Network Efficiency
- Parallel API requests using Promise.all
- Client-side calculations reduce server load
- Efficient data structures for quick rendering

## Accessibility

### Features
- Semantic HTML structure
- Color-coded visual indicators
- Clear text labels for all metrics
- High contrast ratios for readability
- Responsive touch targets for mobile

## Future Enhancements

### Potential Additions
1. **Historical Comparison**: Compare current game stats to team averages
2. **Player-Specific Metrics**: Individual player performance in dashboard
3. **Export Functionality**: Download statistics as PDF/CSV
4. **Custom Metric Selection**: Allow coaches to choose which stats to display
5. **Real-time Charts**: Visual graphs for trending statistics
6. **Notification System**: Alerts for significant statistical events

## Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Progressive Web App (PWA) compatible
- Offline-first architecture support

## Dependencies
- React 19
- Axios (API client)
- CSS Grid and Flexbox
- React Testing Library (for tests)

## Files Modified/Created
```
frontend/src/
├── components/
│   ├── LiveDashboard.tsx          (new, 435 lines)
│   └── LiveMatch.tsx               (modified, +12 lines)
├── styles/
│   └── LiveDashboard.css          (new, 322 lines)
└── test/
    └── LiveDashboard.test.tsx     (new, 13 tests)
```

## Conclusion
The Live Dashboard enhances the ShotSpot application by providing coaches with real-time, actionable insights during matches. The implementation follows React best practices, includes comprehensive testing, and integrates seamlessly with existing features.
