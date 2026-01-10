# Navigation Enhancement - GitHub Issues Breakdown

**Parent Issue:** Navigation Bar Enhancement & Missing Features Implementation  
**Implementation Reference:** See NAVIGATION_PROPOSAL.md for complete architecture overview

> **📋 How to Use This Document:**  
> 1. Each issue below is self-contained with complete implementation details
> 2. The **Quick Reference** section contains shared technical specifications (TypeScript interfaces, API endpoints, CSS patterns)
> 3. Copy any issue directly into GitHub - all necessary context is included
> 4. Reference the Quick Reference section when implementing multiple related features
> 5. Issues are organized by phase (1-4) with clear dependencies listed

---

## Quick Reference: Technical Specifications

This section contains key implementation details extracted from NAVIGATION_PROPOSAL.md. Reference these specifications when implementing individual issues.

### Navigation Structure Overview

```
Primary Navigation (6 top-level items + dropdown menus):
┌─────────────────────────────────────────────────────────────────────────┐
│ 🏠 Dashboard │ 🎮 Matches │ 📊 Analytics │ 🗂️ Data │ ⚙️ Settings │ 👤 User  │
└─────────────────────────────────────────────────────────────────────────┘

Dropdown Structure:
├── 🎮 Matches
│   ├── 📋 All Games (GameManagement)
│   ├── ⚡ Live Match (LiveMatch)
│   └── 📝 Match Templates
├── 📊 Analytics
│   ├── 🎯 Match Analytics (ShotAnalytics)
│   ├── 🏆 Achievements
│   ├── 🔮 Advanced Analytics (NEW)
│   └── 📈 Team Analytics (NEW)
├── 🗂️ Data
│   ├── 👥 Players
│   ├── 🏃 Teams
│   ├── 🏢 Clubs (NEW)
│   ├── 🏆 Competitions (NEW)
│   └── 📊 Series/Divisions (NEW)
├── ⚙️ Settings
│   ├── 📤 Export Center
│   ├── 📋 Report Templates (NEW)
│   ├── 📅 Scheduled Reports (NEW)
│   ├── ⚙️ Export Settings (NEW)
│   ├── 🔗 Twizzit Integration
│   └── 👥 User Management
└── 👤 User Menu
    ├── 🔐 Change Password
    ├── 👤 My Profile (NEW)
    ├── 🏆 My Achievements (NEW)
    └── 🚪 Logout
```

### Core TypeScript Interfaces

```typescript
// Navigation Configuration
interface NavigationItem {
  label: string;
  path?: string;
  icon: string;
  roles: ('user' | 'coach' | 'admin')[];
  children?: NavigationItem[];
  onClick?: () => void;
  badge?: string;
  divider?: boolean;
}

// Clubs
export interface Club {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ClubCreate {
  name: string;
}

// Competitions
export interface Competition {
  id: number;
  name: string;
  type: 'tournament' | 'league';
  season_id: number | null;
  series_id: number | null;
  start_date: string;
  end_date: string | null;
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
  format_config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TournamentBracket {
  id: number;
  competition_id: number;
  round_number: number;
  match_number: number;
  team1_id: number | null;
  team2_id: number | null;
  winner_id: number | null;
  game_id: number | null;
}

export interface LeagueStanding {
  team_id: number;
  team_name: string;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
}

// Scheduled Reports
export interface ScheduledReport {
  id: number;
  template_id: number;
  schedule_type: 'after_match' | 'weekly' | 'monthly' | 'season_end';
  team_id: number | null;
  game_id: number | null;
  weekday: number | null;
  day_of_month: number | null;
  time_of_day: string | null;
  recipients: string[];
  is_active: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
}

// Series
export interface Series {
  id: number;
  name: string;
  level: number;
  region: string | null;
  created_at: string;
  updated_at: string;
}

// Team Analytics
export interface SeasonOverview {
  team_id: number;
  season: string;
  games_played: number;
  wins: number;
  losses: number;
  win_percentage: number;
  avg_goals_for: number;
  avg_goals_against: number;
  top_scorers: PlayerSeasonStats[];
}

export interface MomentumData {
  game_id: number;
  date: string;
  result: string;
  momentum_score: number;
  trend: 'up' | 'down' | 'stable';
}
```

### API Client Patterns

```typescript
// All API clients follow this pattern:
export const <feature>Api = {
  getAll: (params?) => api.get('/<endpoint>', { params }),
  getById: (id: number) => api.get(`/<endpoint>/${id}`),
  create: (data: <Type>Create) => api.post('/<endpoint>', data),
  update: (id: number, data: <Type>Update) => api.put(`/<endpoint>/${id}`, data),
  delete: (id: number) => api.delete(`/<endpoint>/${id}`)
};

// Example: Clubs API
export const clubsApi = {
  getAll: () => api.get('/clubs'),
  getById: (id: number) => api.get(`/clubs/${id}`),
  getTeams: (id: number) => api.get(`/clubs/${id}/teams`),
  getPlayers: (id: number) => api.get(`/clubs/${id}/players`),
  create: (data: ClubCreate) => api.post('/clubs', data),
  update: (id: number, data: ClubUpdate) => api.put(`/clubs/${id}`, data),
  delete: (id: number) => api.delete(`/clubs/${id}`)
};
```

### Role-Based Access Matrix

| Feature | User | Coach | Admin |
|---------|------|-------|-------|
| Dashboard | ✅ | ✅ | ✅ |
| View Matches | ✅ | ✅ | ✅ |
| Create Match | ❌ | ✅ | ✅ |
| Analytics (view) | ✅ | ✅ | ✅ |
| Advanced Analytics | ❌ | ✅ | ✅ |
| Players (view) | ✅ | ✅ | ✅ |
| Players (edit) | ❌ | ✅ | ✅ |
| Teams (view) | ✅ | ✅ | ✅ |
| Teams (edit) | ❌ | ✅ | ✅ |
| Clubs | ❌ | ✅ | ✅ |
| Competitions | ❌ | ✅ | ✅ |
| Scheduled Reports | ❌ | ✅ (own) | ✅ (all) |
| Export Settings | ❌ | ✅ | ✅ |
| Twizzit | ❌ | ✅ | ✅ |
| User Management | ❌ | ❌ | ✅ |
| Series Management | ❌ | ❌ | ✅ |

### CSS Class Naming Conventions

```css
/* Component-based naming */
.component-name { } /* Main container */
.component-name__element { } /* Child element */
.component-name--modifier { } /* Variant */

/* Examples */
.nav-dropdown { }
.nav-dropdown__menu { }
.nav-dropdown__item { }
.nav-dropdown__item--active { }
.nav-dropdown--open { }

.dashboard-widget { }
.dashboard-widget__header { }
.dashboard-widget__body { }
.dashboard-widget--loading { }
```

### Responsive Breakpoints

```typescript
const BREAKPOINTS = {
  mobile: 768,    // < 768px: Mobile view
  tablet: 1024    // 768-1024px: Tablet view, >1024px: Desktop
};

// Usage in CSS:
@media (max-width: 768px) { /* Mobile */ }
@media (min-width: 768px) and (max-width: 1024px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
```

### Backend API Endpoints Reference

```
Clubs:
  GET    /api/clubs
  POST   /api/clubs
  GET    /api/clubs/:id
  PUT    /api/clubs/:id
  DELETE /api/clubs/:id
  GET    /api/clubs/:id/teams
  GET    /api/clubs/:id/players

Competitions:
  GET    /api/competitions
  POST   /api/competitions
  GET    /api/competitions/:id
  PUT    /api/competitions/:id
  DELETE /api/competitions/:id
  GET    /api/competitions/:id/teams
  POST   /api/competitions/:id/teams
  DELETE /api/competitions/:id/teams/:teamId
  GET    /api/competitions/:id/bracket
  POST   /api/competitions/:id/bracket/generate
  PUT    /api/competitions/:id/bracket/:bracketId
  GET    /api/competitions/:id/standings
  POST   /api/competitions/:id/standings/initialize
  POST   /api/competitions/:id/standings/update

Advanced Analytics:
  GET    /api/advanced-analytics/predictions/form-trends/:playerId
  GET    /api/advanced-analytics/predictions/fatigue/:playerId
  GET    /api/advanced-analytics/predictions/next-game/:playerId
  GET    /api/advanced-analytics/benchmarks/league-averages
  GET    /api/advanced-analytics/benchmarks/player-comparison/:playerId
  GET    /api/advanced-analytics/benchmarks/historical/:entityType/:entityId
  POST   /api/advanced-analytics/video/link-event
  GET    /api/advanced-analytics/video/game/:gameId
  GET    /api/advanced-analytics/video/highlights/:gameId

Scheduled Reports:
  GET    /api/scheduled-reports
  POST   /api/scheduled-reports
  GET    /api/scheduled-reports/:id
  PUT    /api/scheduled-reports/:id
  DELETE /api/scheduled-reports/:id
  POST   /api/scheduled-reports/:id/run
  GET    /api/scheduled-reports/:id/history

Report Templates:
  GET    /api/report-templates
  POST   /api/report-templates
  PUT    /api/report-templates/:id
  DELETE /api/report-templates/:id

Team Analytics:
  GET    /api/team-analytics/:teamId/season-overview
  GET    /api/team-analytics/:teamId/momentum
  GET    /api/team-analytics/:teamId/strengths-weaknesses

Series:
  GET    /api/series
  POST   /api/series
  GET    /api/series/:id
  PUT    /api/series/:id
  DELETE /api/series/:id

Export Settings:
  GET    /api/export-settings
  PUT    /api/export-settings
  POST   /api/export-settings/reset
```

---

## Issue Organization

### Milestones
- **Milestone 1:** Core Navigation (Phase 1)
- **Milestone 2:** Critical Features (Phase 2)
- **Milestone 3:** Advanced Features (Phase 3)
- **Milestone 4:** Enhancement & Polish (Phase 4)

---

## Phase 1: Core Navigation Infrastructure (Milestone 1)

### Issue #1: Design New Navigation Component Structure
**Priority:** Highest  
**Dependencies:** None

**Description:**
Design and implement the new navigation bar component with dropdown menu support and mobile responsiveness.

**Acceptance Criteria:**
- [ ] Create `Navigation.tsx` component with dropdown menu structure
- [ ] Implement `NavigationDropdown.tsx` for submenu items
- [ ] Create `MobileMenu.tsx` for mobile/tablet views
- [ ] Add responsive breakpoints (desktop >1024px, tablet 768-1024px, mobile <768px)
- [ ] Implement hamburger menu icon and slide-out panel for mobile
- [ ] Support keyboard navigation (Tab, Enter, Escape)
- [ ] Add ARIA labels for accessibility
- [ ] Active route highlighting
- [ ] Smooth transitions and animations

**Navigation Structure:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🏠 Dashboard │ 🎮 Matches │ 📊 Analytics │ 🗂️ Data │ ⚙️ Settings │ 👤 User  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Dropdown Menu Structure:**
- **Matches:** All Games, Live Match, Match Templates
- **Analytics:** Match Analytics, Achievements, Advanced Analytics, Team Analytics
- **Data:** Players, Teams, Clubs, Competitions, Series/Divisions
- **Settings:** Export Center, Report Templates, Scheduled Reports, Export Settings, Twizzit, User Management
- **User Menu:** Change Password, My Profile, My Achievements, Logout

**Technical Details:**
```typescript
// Navigation.tsx interface
interface NavigationItem {
  label: string;
  path?: string;
  icon: string;
  roles: ('user' | 'coach' | 'admin')[];
  children?: NavigationItem[];
  onClick?: () => void;
}

const navigationConfig: NavigationItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: '🏠',
    roles: ['user', 'coach', 'admin']
  },
  {
    label: 'Matches',
    icon: '🎮',
    roles: ['user', 'coach', 'admin'],
    children: [
      { label: 'All Games', path: '/games', icon: '📋', roles: ['user', 'coach', 'admin'] },
      { label: 'Live Match', path: '/match', icon: '⚡', roles: ['user', 'coach', 'admin'] },
      { label: 'Templates', path: '/templates', icon: '📝', roles: ['coach', 'admin'] }
    ]
  },
  // ... other items
];

// NavigationDropdown.tsx props
interface NavigationDropdownProps {
  label: string;
  icon: string;
  children: NavigationItem[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

// MobileMenu.tsx props
interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navigationItems: NavigationItem[];
  userRole: string;
}
```

**Responsive Breakpoints:**
```typescript
// Desktop (>1024px): Full horizontal navigation with dropdowns
// Tablet (768-1024px): Logo + hamburger + user dropdown
// Mobile (<768px): Logo + hamburger + user icon, full-screen slide-out

const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024
};
```

**CSS Architecture:**
```css
/* Desktop Navigation */
.navigation-v2 {
  display: flex;
  align-items: center;
  gap: 2rem;
}

/* Dropdown Menu */
.nav-dropdown {
  position: relative;
}

.nav-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 200px;
  z-index: 1000;
}

.nav-dropdown-item {
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-dropdown-item:hover {
  background: var(--primary-light);
}

/* Mobile Menu */
.mobile-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 999;
}

.mobile-menu-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 280px;
  background: white;
  box-shadow: -2px 0 8px rgba(0,0,0,0.1);
  z-index: 1000;
  transform: translateX(100%);
  transition: transform 0.3s ease;
}

.mobile-menu-panel.open {
  transform: translateX(0);
}

/* Active Route Highlighting */
.nav-item.active {
  background: rgba(255, 255, 255, 0.2);
  border-bottom: 3px solid var(--primary-color);
}
```

**Keyboard Navigation:**
- Tab: Move between top-level items
- Enter/Space: Open dropdown or navigate to link
- Escape: Close dropdown
- Arrow keys: Navigate within dropdown

**Accessibility:**
```typescript
// ARIA attributes
aria-label="Main navigation"
aria-haspopup="true"
aria-expanded={isOpen}
role="menu"
role="menuitem"
```

**Files to Create:**
- `frontend/src/components/Navigation.tsx` (complete rewrite)
- `frontend/src/components/NavigationDropdown.tsx`
- `frontend/src/components/MobileMenu.tsx`
- `frontend/src/components/NavigationItem.tsx`
- `frontend/src/config/navigation.ts` (navigation configuration)
- `frontend/src/styles/Navigation.css`

**Files to Modify:**
- `frontend/src/styles/main.css` (add navigation v2 imports)

---

### Issue #2: Implement Role-Based Navigation Visibility
**Priority:** High  
**Dependencies:** #1

**Description:**
Implement role-based visibility logic for navigation items based on user permissions (user/coach/admin).

**Acceptance Criteria:**
- [ ] Create navigation configuration with role requirements
- [ ] Implement `useNavigation` hook for role checking
- [ ] Hide/show menu items based on user role
- [ ] Add visual indicators for admin-only sections
- [ ] Update tests to cover role-based visibility
- [ ] Document role visibility matrix

**Technical Details:**
```typescript
interface NavigationItem {
  label: string;
  path: string;
  icon: string;
  roles: ('user' | 'coach' | 'admin')[];
  children?: NavigationItem[];
}
```

**Files to Create:**
- `frontend/src/hooks/useNavigation.ts`
- `frontend/src/config/navigation.ts`

**Files to Modify:**
- `frontend/src/components/Navigation.tsx`

---

### Issue #3: Create Dashboard Landing Page
**Priority:** High  
**Dependencies:** #1

**Description:**
Build the main dashboard page that serves as the application landing page with quick actions and overview widgets.

**Acceptance Criteria:**
- [ ] Create `Dashboard.tsx` component
- [ ] Recent matches widget (last 5 games)
- [ ] Upcoming games widget
- [ ] Quick stats summary (total teams, players, games)
- [ ] Achievements feed (recent achievements earned)
- [ ] Notifications panel
- [ ] Quick action buttons (New Game, View Analytics, etc.)
- [ ] Responsive grid layout
- [ ] Loading states and error handling
- [ ] Real-time updates via WebSocket (if applicable)

**API Endpoints Used:**
- `GET /api/games?limit=5&sort=recent`
- `GET /api/games?status=upcoming`
- `GET /api/achievements/recent`
- Dashboard-specific summary endpoint (may need backend support)

**Files to Create:**
- `frontend/src/components/Dashboard.tsx`
- `frontend/src/components/DashboardWidget.tsx`
- `frontend/src/components/QuickActions.tsx`
- `frontend/src/styles/Dashboard.css`

**Files to Modify:**
- `frontend/src/App.tsx` (add dashboard route)

---

### Issue #4: Update App Routing for New Navigation Structure
**Priority:** High  
**Dependencies:** #1, #3

**Description:**
Update React Router configuration to support new navigation structure and add all new routes.

**Acceptance Criteria:**
- [ ] Change default route from `/teams` to `/dashboard`
- [ ] Add protected routes for all new features
- [ ] Implement route guards for role-based access
- [ ] Add 404 page for unknown routes
- [ ] Update navigation links to use new structure
- [ ] Add lazy loading for heavy components
- [ ] Update existing routes to fit new structure

**Files to Modify:**
- `frontend/src/App.tsx`
- `frontend/src/components/ProtectedRoute.tsx` (add role checking)

---

### Issue #5: Create Navigation Styles and Animations
**Priority:** Medium  
**Dependencies:** #1

**Description:**
Implement comprehensive CSS styling and animations for the new navigation system.

**Acceptance Criteria:**
- [ ] Navigation bar styling with brand colors
- [ ] Dropdown menu styles with shadows and transitions
- [ ] Mobile menu slide-out animation
- [ ] Hover and focus states
- [ ] Active route indicator styling
- [ ] Responsive breakpoints
- [ ] Dark mode support (if applicable)
- [ ] Print stylesheet (hide navigation)
- [ ] Accessibility: focus outlines, high contrast support

**Files to Modify:**
- `frontend/src/styles/main.css`

**Files to Create:**
- `frontend/src/styles/Navigation.css`
- `frontend/src/styles/MobileMenu.css`

---

## Phase 2: Critical Missing Features (Milestone 2)

### Issue #6: Implement Clubs Management Component
**Priority:** High  
**Dependencies:** #1, #4

**Description:**
Create a complete CRUD interface for managing clubs with team and player hierarchy views.

**Acceptance Criteria:**
- [ ] Create `ClubManagement.tsx` main component
- [ ] List all clubs with search/filter
- [ ] Create club dialog with form validation
- [ ] Edit club functionality
- [ ] Delete club with confirmation
- [ ] View teams by club
- [ ] View players by club
- [ ] Pagination for large datasets
- [ ] Error handling and user feedback
- [ ] Loading states

**API Endpoints:**
```
GET    /api/clubs                 - List all clubs
POST   /api/clubs                 - Create new club
GET    /api/clubs/:id             - Get club details
PUT    /api/clubs/:id             - Update club
DELETE /api/clubs/:id             - Delete club
GET    /api/clubs/:id/teams       - Get teams in club
GET    /api/clubs/:id/players     - Get players in club
```

**TypeScript Interfaces:**
```typescript
export interface Club {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ClubCreate {
  name: string;
}

export interface ClubUpdate {
  name: string;
}

// Component props
interface ClubManagementProps {
  // No required props - standalone page
}

interface ClubDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  club?: Club;  // If editing existing club
}

interface ClubCardProps {
  club: Club;
  onEdit: (club: Club) => void;
  onDelete: (clubId: number) => void;
  onViewTeams: (clubId: number) => void;
  onViewPlayers: (clubId: number) => void;
}
```

**Component Structure:**
```typescript
// ClubManagement.tsx - Main component
const ClubManagement: React.FC = () => {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClub, setSelectedClub] = useState<Club | undefined>();
  
  // Fetch clubs on mount
  useEffect(() => {
    fetchClubs();
  }, []);
  
  const fetchClubs = async () => {
    try {
      setLoading(true);
      const response = await clubsApi.getAll();
      setClubs(response.data);
    } catch (err) {
      setError('Failed to load clubs');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this club?')) return;
    try {
      await clubsApi.delete(id);
      setClubs(clubs.filter(c => c.id !== id));
      // Show success toast
    } catch (err) {
      setError('Failed to delete club');
    }
  };
  
  const filteredClubs = clubs.filter(club =>
    club.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="club-management">
      <div className="header">
        <h2>Clubs Management</h2>
        <button onClick={() => setDialogOpen(true)}>Add Club</button>
      </div>
      
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search clubs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {loading && <div>Loading...</div>}
      {error && <div className="error">{error}</div>}
      
      <div className="club-grid">
        {filteredClubs.map(club => (
          <ClubCard
            key={club.id}
            club={club}
            onEdit={(c) => { setSelectedClub(c); setDialogOpen(true); }}
            onDelete={handleDelete}
            onViewTeams={(id) => navigate(`/clubs/${id}/teams`)}
            onViewPlayers={(id) => navigate(`/clubs/${id}/players`)}
          />
        ))}
      </div>
      
      <ClubDialog
        isOpen={dialogOpen}
        onClose={() => { setDialogOpen(false); setSelectedClub(undefined); }}
        onSuccess={() => { fetchClubs(); setDialogOpen(false); }}
        club={selectedClub}
      />
    </div>
  );
};
```

**ClubDialog Form Validation:**
```typescript
const schema = {
  name: {
    required: 'Club name is required',
    minLength: { value: 2, message: 'Minimum 2 characters' },
    maxLength: { value: 100, message: 'Maximum 100 characters' }
  }
};
```

**CSS Layout:**
```css
.club-management {
  padding: 2rem;
}

.club-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.club-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1.5rem;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.club-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.club-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.club-card__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}
```

**Files to Create:**
- `frontend/src/components/ClubManagement.tsx`
- `frontend/src/components/ClubDialog.tsx`
- `frontend/src/components/ClubCard.tsx`
- `frontend/src/services/clubsApi.ts`
- `frontend/src/types/clubs.ts`
- `frontend/src/styles/ClubManagement.css`

**Files to Modify:**
- `frontend/src/App.tsx` (add route)

**Tests to Create:**
- `frontend/src/test/ClubManagement.test.tsx`

**Testing Requirements:**
- Test CRUD operations
- Test search/filter functionality
- Test error handling
- Test confirmation dialogs
- Test loading states

---

### Issue #7: Create API Client for Clubs
**Priority:** High  
**Dependencies:** None

**Description:**
Create TypeScript API client wrapper for clubs endpoints.

**Acceptance Criteria:**
- [ ] Define TypeScript interfaces for Club types
- [ ] Create `clubsApi` object with all methods
- [ ] Proper error handling
- [ ] Type-safe request/response handling
- [ ] JSDoc comments for all methods

**Files to Create:**
- `frontend/src/services/clubsApi.ts`
- `frontend/src/types/clubs.ts`

**Files to Modify:**
- `frontend/src/utils/api.ts` (if needed for exports)

---

### Issue #8: Implement Competitions Management Component
**Priority:** High  
**Dependencies:** #1, #4

**Description:**
Build comprehensive competition management system supporting tournaments and leagues with team registration, bracket generation, and standings.

**Acceptance Criteria:**
- [ ] Create `CompetitionManagement.tsx` main component
- [ ] List competitions with type/status filters
- [ ] Create competition dialog (tournament vs league)
- [ ] Edit and delete competitions
- [ ] Team registration interface
- [ ] Competition type selector (tournament/league)
- [ ] Status management (upcoming/in_progress/completed/cancelled)
- [ ] Format configuration UI
- [ ] Search and pagination
- [ ] Navigate to brackets (tournaments) or standings (leagues)

**API Endpoints:**
```
GET    /api/competitions                              - List all (filter by type, season, status)
POST   /api/competitions                              - Create new competition
GET    /api/competitions/:id                          - Get competition details
PUT    /api/competitions/:id                          - Update competition
DELETE /api/competitions/:id                          - Delete competition
GET    /api/competitions/:id/teams                    - Get registered teams
POST   /api/competitions/:id/teams                    - Add team to competition
DELETE /api/competitions/:id/teams/:teamId            - Remove team
GET    /api/competitions/:id/bracket                  - Get tournament bracket
POST   /api/competitions/:id/bracket/generate         - Generate bracket
GET    /api/competitions/:id/standings                - Get league standings
```

**TypeScript Interfaces:**
```typescript
export interface Competition {
  id: number;
  name: string;
  type: 'tournament' | 'league';
  season_id: number | null;
  series_id: number | null;
  start_date: string;
  end_date: string | null;
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
  format_config: {
    bracket_type?: 'single_elimination' | 'double_elimination';
    points_win?: number;
    points_draw?: number;
    points_loss?: number;
    groups?: number;
    teams_per_group?: number;
  };
  created_at: string;
  updated_at: string;
}

export interface CompetitionCreate {
  name: string;
  type: 'tournament' | 'league';
  season_id?: number;
  series_id?: number;
  start_date: string;
  end_date?: string;
  format_config?: Record<string, any>;
}

export interface CompetitionTeam {
  competition_id: number;
  team_id: number;
  team_name: string;
  seed?: number;
  group?: string;
}
```

**Component Structure:**
```typescript
// CompetitionManagement.tsx
const CompetitionManagement: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [filters, setFilters] = useState({
    type: '', // 'tournament', 'league', or ''
    status: '', // 'upcoming', 'in_progress', 'completed', 'cancelled', or ''
    search: ''
  });
  
  const filteredCompetitions = competitions.filter(comp => {
    if (filters.type && comp.type !== filters.type) return false;
    if (filters.status && comp.status !== filters.status) return false;
    if (filters.search && !comp.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });
  
  return (
    <div className="competition-management">
      <div className="header">
        <h2>Competitions Management</h2>
        <button onClick={() => setDialogOpen(true)}>Create Competition</button>
      </div>
      
      <div className="filters">
        <select value={filters.type} onChange={(e) => setFilters({...filters, type: e.target.value})}>
          <option value="">All Types</option>
          <option value="tournament">Tournaments</option>
          <option value="league">Leagues</option>
        </select>
        
        <select value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}>
          <option value="">All Statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        
        <input
          type="text"
          placeholder="Search competitions..."
          value={filters.search}
          onChange={(e) => setFilters({...filters, search: e.target.value})}
        />
      </div>
      
      <div className="competition-grid">
        {filteredCompetitions.map(comp => (
          <CompetitionCard
            key={comp.id}
            competition={comp}
            onEdit={(c) => { setSelectedComp(c); setDialogOpen(true); }}
            onDelete={handleDelete}
            onViewDetails={(id) => navigate(`/competitions/${id}`)}
            onManageTeams={(id) => setTeamsDialogOpen(true)}
          />
        ))}
      </div>
    </div>
  );
};
```

**CompetitionDialog - Form Structure:**
```typescript
// CompetitionDialog.tsx
interface FormData {
  name: string;
  type: 'tournament' | 'league';
  start_date: string;
  end_date: string;
  season_id?: number;
  series_id?: number;
  // Format config based on type
  bracket_type?: 'single_elimination' | 'double_elimination';
  points_win?: number;
  points_draw?: number;
  points_loss?: number;
}

// Validation schema
const schema = {
  name: {
    required: 'Competition name is required',
    minLength: { value: 3, message: 'Minimum 3 characters' }
  },
  type: {
    required: 'Competition type is required'
  },
  start_date: {
    required: 'Start date is required'
  }
};

// Conditional form fields
{formData.type === 'tournament' && (
  <select name="bracket_type" value={formData.bracket_type}>
    <option value="single_elimination">Single Elimination</option>
    <option value="double_elimination">Double Elimination</option>
  </select>
)}

{formData.type === 'league' && (
  <>
    <input type="number" name="points_win" placeholder="Points for win" defaultValue={3} />
    <input type="number" name="points_draw" placeholder="Points for draw" defaultValue={1} />
    <input type="number" name="points_loss" placeholder="Points for loss" defaultValue={0} />
  </>
)}
```

**CompetitionCard - Visual Design:**
```typescript
// CompetitionCard.tsx
const CompetitionCard: React.FC<CompetitionCardProps> = ({ competition, onEdit, onDelete, onViewDetails, onManageTeams }) => {
  const statusColors = {
    upcoming: '#3498db',
    in_progress: '#27ae60',
    completed: '#95a5a6',
    cancelled: '#e74c3c'
  };
  
  return (
    <div className="competition-card">
      <div className="competition-card__badge" style={{background: statusColors[competition.status]}}>
        {competition.type === 'tournament' ? '🏆' : '📊'} {competition.type.toUpperCase()}
      </div>
      
      <h3>{competition.name}</h3>
      
      <div className="competition-card__meta">
        <span className={`status status--${competition.status}`}>
          {competition.status.replace('_', ' ')}
        </span>
        <span className="date">
          {new Date(competition.start_date).toLocaleDateString()}
        </span>
      </div>
      
      <div className="competition-card__actions">
        {competition.type === 'tournament' && (
          <button onClick={() => navigate(`/competitions/${competition.id}/bracket`)}>
            View Bracket
          </button>
        )}
        {competition.type === 'league' && (
          <button onClick={() => navigate(`/competitions/${competition.id}/standings`)}>
            View Standings
          </button>
        )}
        <button onClick={() => onManageTeams(competition.id)}>Teams</button>
        <button onClick={() => onEdit(competition)}>Edit</button>
        <button onClick={() => onDelete(competition.id)} className="danger">Delete</button>
      </div>
    </div>
  );
};
```

**Team Registration Dialog:**
```typescript
// TeamRegistrationDialog.tsx - Shown when "Manage Teams" is clicked
interface TeamRegistrationDialogProps {
  competition: Competition;
  isOpen: boolean;
  onClose: () => void;
}

const TeamRegistrationDialog: React.FC<TeamRegistrationDialogProps> = ({ competition, isOpen, onClose }) => {
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [registeredTeams, setRegisteredTeams] = useState<CompetitionTeam[]>([]);
  
  const handleAddTeam = async (teamId: number) => {
    await competitionsApi.addTeam(competition.id, teamId);
    // Refresh registered teams
    fetchRegisteredTeams();
  };
  
  const handleRemoveTeam = async (teamId: number) => {
    await competitionsApi.removeTeam(competition.id, teamId);
    fetchRegisteredTeams();
  };
  
  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <h3>Manage Teams - {competition.name}</h3>
      
      <div className="teams-layout">
        <div className="available-teams">
          <h4>Available Teams</h4>
          {availableTeams.map(team => (
            <div key={team.id} className="team-item">
              {team.name}
              <button onClick={() => handleAddTeam(team.id)}>Add</button>
            </div>
          ))}
        </div>
        
        <div className="registered-teams">
          <h4>Registered Teams ({registeredTeams.length})</h4>
          {registeredTeams.map(team => (
            <div key={team.team_id} className="team-item">
              {team.team_name}
              <button onClick={() => handleRemoveTeam(team.team_id)} className="danger">Remove</button>
            </div>
          ))}
        </div>
      </div>
      
      {competition.type === 'tournament' && registeredTeams.length >= 4 && (
        <button onClick={() => generateBracket(competition.id)} className="primary">
          Generate Bracket
        </button>
      )}
    </Dialog>
  );
};
```

**CSS Styling:**
```css
.competition-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.competition-card {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 1.5rem;
  background: white;
  position: relative;
  overflow: hidden;
}

.competition-card__badge {
  position: absolute;
  top: 0;
  right: 0;
  padding: 0.5rem 1rem;
  color: white;
  font-weight: bold;
  font-size: 0.75rem;
  border-bottom-left-radius: 12px;
}

.status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.status--upcoming { background: #e3f2fd; color: #1976d2; }
.status--in_progress { background: #e8f5e9; color: #388e3c; }
.status--completed { background: #f5f5f5; color: #616161; }
.status--cancelled { background: #ffebee; color: #c62828; }

.filters {
  display: flex;
  gap: 1rem;
  margin: 1.5rem 0;
  flex-wrap: wrap;
}

.teams-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin: 1rem 0;
}
```

**Files to Create:**
- `frontend/src/components/CompetitionManagement.tsx`
- `frontend/src/components/CompetitionDialog.tsx`
- `frontend/src/components/CompetitionCard.tsx`
- `frontend/src/components/TeamRegistrationDialog.tsx`
- `frontend/src/services/competitionsApi.ts`
- `frontend/src/types/competitions.ts`
- `frontend/src/styles/CompetitionManagement.css`

**Files to Modify:**
- `frontend/src/App.tsx` (add routes for /competitions, /competitions/:id/bracket, /competitions/:id/standings)

**Tests to Create:**
- `frontend/src/test/CompetitionManagement.test.tsx`
- Test tournament vs league creation
- Test status transitions
- Test team registration
- Test filter functionality

---

### Issue #9: Build Tournament Bracket Visualization
**Priority:** Medium  
**Dependencies:** #8

**Description:**
Create interactive tournament bracket visualization with drag-and-drop team assignment.

**Acceptance Criteria:**
- [ ] Create `TournamentBracket.tsx` component
- [ ] SVG-based bracket rendering
- [ ] Support multiple bracket sizes (4, 8, 16, 32 teams)
- [ ] Display team names and scores
- [ ] Click to update match results
- [ ] Generate bracket from team list
- [ ] Winner progression logic
- [ ] Export bracket as image/PDF
- [ ] Responsive design for mobile
- [ ] Animation for winner advancement

**API Endpoints:**
- `GET /api/competitions/:id/bracket`
- `POST /api/competitions/:id/bracket/generate`
- `PUT /api/competitions/:id/bracket/:bracketId`

**Files to Create:**
- `frontend/src/components/TournamentBracket.tsx`
- `frontend/src/components/BracketMatch.tsx`
- `frontend/src/utils/bracketGenerator.ts`
- `frontend/src/styles/TournamentBracket.css`

---

### Issue #10: Build League Standings Table
**Priority:** Medium  
**Dependencies:** #8

**Description:**
Create sortable league standings table with automatic point calculation.

**Acceptance Criteria:**
- [ ] Create `LeagueStandings.tsx` component
- [ ] Display team rankings with stats
- [ ] Columns: Position, Team, GP, W, D, L, GF, GA, GD, Points
- [ ] Sortable columns
- [ ] Highlight promotion/relegation zones
- [ ] Auto-update from game results
- [ ] Manual point adjustment (admin only)
- [ ] Export to CSV
- [ ] Responsive table for mobile

**API Endpoints:**
- `GET /api/competitions/:id/standings`
- `POST /api/competitions/:id/standings/initialize`
- `POST /api/competitions/:id/standings/update`

**Files to Create:**
- `frontend/src/components/LeagueStandings.tsx`
- `frontend/src/components/StandingsRow.tsx`
- `frontend/src/styles/LeagueStandings.css`

---

### Issue #11: Create Competitions API Client
**Priority:** High  
**Dependencies:** None

**Description:**
Create TypeScript API client wrapper for competitions, brackets, and standings.

**Acceptance Criteria:**
- [ ] Define TypeScript interfaces for all competition types
- [ ] Create `competitionsApi` object with all methods
- [ ] Bracket and standings API wrappers
- [ ] Type-safe error handling
- [ ] JSDoc documentation

**Files to Create:**
- `frontend/src/services/competitionsApi.ts`
- `frontend/src/types/competitions.ts`

---

## Phase 3: Advanced Features (Milestone 3)

### Issue #12: Implement Advanced Analytics Dashboard
**Priority:** Medium  
**Dependencies:** #1, #4

**Description:**
Build advanced analytics dashboard with predictions, form trends, and fatigue analysis.

**Acceptance Criteria:**
- [ ] Create `AdvancedAnalytics.tsx` main component
- [ ] Player selector dropdown
- [ ] Tab navigation (Form Trends, Fatigue, Predictions, Video)
- [ ] Integrate with existing chart libraries (recharts)
- [ ] Export analytics as PDF/image
- [ ] Date range filters
- [ ] Loading and error states
- [ ] Responsive design

**API Endpoints:**
- `GET /api/advanced-analytics/predictions/form-trends/:playerId`
- `GET /api/advanced-analytics/predictions/fatigue/:playerId`
- `GET /api/advanced-analytics/predictions/next-game/:playerId`
- `GET /api/advanced-analytics/benchmarks/player-comparison/:playerId`

**Files to Create:**
- `frontend/src/components/AdvancedAnalytics.tsx`
- `frontend/src/types/advanced-analytics.ts`
- `frontend/src/styles/AdvancedAnalytics.css`

---

### Issue #13: Build Form Trends Visualization
**Priority:** Medium  
**Dependencies:** #12

**Description:**
Create visual representation of player form trends over recent games.

**Acceptance Criteria:**
- [ ] Create `FormTrends.tsx` component
- [ ] Line chart showing performance metrics over time
- [ ] Trend indicator (improving/declining/stable)
- [ ] Color-coded zones (hot/cold streaks)
- [ ] Tooltip with detailed game stats
- [ ] Adjustable time window (last 5/10/15 games)
- [ ] Metric selector (FG%, points, efficiency)

**Files to Create:**
- `frontend/src/components/FormTrends.tsx`
- `frontend/src/styles/FormTrends.css`

---

### Issue #14: Build Fatigue Analysis Component
**Priority:** Medium  
**Dependencies:** #12

**Description:**
Create fatigue analysis dashboard showing player workload and rest recommendations.

**Acceptance Criteria:**
- [ ] Create `FatigueAnalysis.tsx` component
- [ ] Fatigue score gauge (0-100)
- [ ] Minutes played over time chart
- [ ] Rest recommendation system
- [ ] Injury risk indicator
- [ ] Workload comparison vs team average
- [ ] Color-coded alerts (green/yellow/red)

**Files to Create:**
- `frontend/src/components/FatigueAnalysis.tsx`
- `frontend/src/components/FatigueGauge.tsx`
- `frontend/src/styles/FatigueAnalysis.css`

---

### Issue #15: Build Predictions Panel
**Priority:** Medium  
**Dependencies:** #12

**Description:**
Create predictions panel showing expected performance for next game.

**Acceptance Criteria:**
- [ ] Create `PredictionsPanel.tsx` component
- [ ] Predicted stats cards (shots, goals, efficiency)
- [ ] Confidence intervals
- [ ] Historical comparison
- [ ] Factors affecting prediction (rest, opponent, venue)
- [ ] Disclaimer about prediction accuracy

**Files to Create:**
- `frontend/src/components/PredictionsPanel.tsx`
- `frontend/src/components/PredictionCard.tsx`
- `frontend/src/styles/Predictions.css`

---

### Issue #16: Implement Video Event Linking
**Priority:** Low  
**Dependencies:** #12

**Description:**
Build interface for linking video timestamps to game events.

**Acceptance Criteria:**
- [ ] Create `VideoLinkEditor.tsx` component
- [ ] Video URL input and validation
- [ ] Timestamp selector
- [ ] Event selector (shots, fouls, etc.)
- [ ] Link video to specific game events
- [ ] Preview linked videos
- [ ] Auto-highlight generation
- [ ] Export highlight reel

**API Endpoints:**
- `POST /api/advanced-analytics/video/link-event`
- `GET /api/advanced-analytics/video/game/:gameId`
- `GET /api/advanced-analytics/video/highlights/:gameId`

**Files to Create:**
- `frontend/src/components/VideoLinkEditor.tsx`
- `frontend/src/components/VideoPlayer.tsx`
- `frontend/src/styles/VideoAnalysis.css`

---

### Issue #17: Create Advanced Analytics API Client
**Priority:** Medium  
**Dependencies:** None

**Description:**
Create TypeScript API client for advanced analytics endpoints.

**Acceptance Criteria:**
- [ ] Define TypeScript interfaces
- [ ] Create `advancedAnalyticsApi` object
- [ ] Type-safe methods for all endpoints
- [ ] Error handling

**Files to Create:**
- `frontend/src/services/advancedAnalyticsApi.ts`
- `frontend/src/types/advanced-analytics.ts`

---

### Issue #18: Implement Scheduled Reports Management
**Priority:** Medium  
**Dependencies:** #1, #4

**Description:**
Build interface for creating and managing automated report schedules.

**Acceptance Criteria:**
- [ ] Create `ScheduledReports.tsx` component
- [ ] List scheduled reports
- [ ] Create schedule dialog with cron-like options
- [ ] Schedule types: after_match, weekly, monthly, season_end
- [ ] Email recipient management
- [ ] Template selector
- [ ] Enable/disable schedules
- [ ] Manual trigger button
- [ ] Execution history view
- [ ] Next run time display

**API Endpoints:**
- `GET /api/scheduled-reports`
- `POST /api/scheduled-reports`
- `PUT /api/scheduled-reports/:id`
- `DELETE /api/scheduled-reports/:id`
- `POST /api/scheduled-reports/:id/run`
- `GET /api/scheduled-reports/:id/history`

**Files to Create:**
- `frontend/src/components/ScheduledReports.tsx`
- `frontend/src/components/ReportScheduleDialog.tsx`
- `frontend/src/components/ExecutionHistory.tsx`
- `frontend/src/types/scheduled-reports.ts`
- `frontend/src/styles/ScheduledReports.css`

---

### Issue #19: Build Schedule Configuration Form
**Priority:** Medium  
**Dependencies:** #18

**Description:**
Create user-friendly form for configuring report schedules.

**Acceptance Criteria:**
- [ ] Schedule type selector (radio buttons)
- [ ] Conditional fields based on type
- [ ] Time picker for daily schedules
- [ ] Weekday selector for weekly
- [ ] Day of month selector for monthly
- [ ] Email input with validation (multiple recipients)
- [ ] Template dropdown
- [ ] Team/game filters
- [ ] Form validation
- [ ] Preview next execution time

**Files to Create:**
- `frontend/src/components/ScheduleConfigForm.tsx`
- `frontend/src/components/TimeSchedulePicker.tsx`

---

### Issue #20: Create Scheduled Reports API Client
**Priority:** Medium  
**Dependencies:** None

**Description:**
Create TypeScript API client for scheduled reports.

**Files to Create:**
- `frontend/src/services/scheduledReportsApi.ts`
- `frontend/src/types/scheduled-reports.ts`

---

## Phase 4: Enhancement & Polish (Milestone 4)

### Issue #21: Build Report Templates Manager
**Priority:** Low  
**Dependencies:** #1, #4

**Description:**
Create visual report template builder with drag-and-drop section ordering.

**Acceptance Criteria:**
- [ ] Create `ReportTemplates.tsx` component
- [ ] List existing templates
- [ ] Template builder UI
- [ ] Drag-and-drop section reordering
- [ ] Section type selector (stats, charts, commentary, etc.)
- [ ] Section configuration options
- [ ] Preview functionality
- [ ] Save/update templates
- [ ] Duplicate template
- [ ] Delete template with confirmation
- [ ] Export template as JSON

**API Endpoints:**
- `GET /api/report-templates`
- `POST /api/report-templates`
- `PUT /api/report-templates/:id`
- `DELETE /api/report-templates/:id`

**Files to Create:**
- `frontend/src/components/ReportTemplates.tsx`
- `frontend/src/components/TemplateBuilder.tsx`
- `frontend/src/components/TemplatePreview.tsx`
- `frontend/src/components/TemplateSectionEditor.tsx`
- `frontend/src/types/report-templates.ts`
- `frontend/src/styles/ReportTemplates.css`

---

### Issue #22: Implement Team Analytics Dashboard
**Priority:** Low  
**Dependencies:** #1, #4

**Description:**
Build team-level analytics dashboard with season overview and momentum tracking.

**Acceptance Criteria:**
- [ ] Create `TeamAnalytics.tsx` component
- [ ] Season selector dropdown
- [ ] Win/loss record display
- [ ] Top scorers leaderboard
- [ ] Team momentum chart
- [ ] Strengths/weaknesses analysis
- [ ] Period-by-period breakdown
- [ ] Comparison with previous season
- [ ] Export dashboard as PDF

**API Endpoints:**
- `GET /api/team-analytics/:teamId/season-overview`
- `GET /api/team-analytics/:teamId/momentum`
- `GET /api/team-analytics/:teamId/strengths-weaknesses`

**Files to Create:**
- `frontend/src/components/TeamAnalytics.tsx`
- `frontend/src/components/SeasonOverview.tsx`
- `frontend/src/components/MomentumChart.tsx`
- `frontend/src/types/team-analytics.ts`
- `frontend/src/styles/TeamAnalytics.css`

---

### Issue #23: Implement Series/Divisions Management
**Priority:** Low  
**Dependencies:** #1, #4

**Description:**
Create interface for managing Belgian korfball division hierarchy.

**Acceptance Criteria:**
- [ ] Create `SeriesManagement.tsx` component
- [ ] List all series/divisions ordered by level
- [ ] Create series dialog
- [ ] Edit series details
- [ ] Delete series
- [ ] View competitions in series
- [ ] Level ordering (drag-and-drop or up/down buttons)
- [ ] Region assignment

**API Endpoints:**
- `GET /api/series`
- `POST /api/series`
- `GET /api/series/:id`
- `PUT /api/series/:id`
- `DELETE /api/series/:id`

**Files to Create:**
- `frontend/src/components/SeriesManagement.tsx`
- `frontend/src/components/SeriesDialog.tsx`
- `frontend/src/types/series.ts`
- `frontend/src/styles/SeriesManagement.css`

---

### Issue #24: Create Settings/Preferences Page
**Priority:** Low  
**Dependencies:** #1, #4

**Description:**
Build centralized settings page with export settings, user preferences, and system configuration.

**Acceptance Criteria:**
- [ ] Create `SettingsPage.tsx` component
- [ ] Tab navigation for settings categories
- [ ] Export Settings tab (from ExportCenter)
- [ ] User Preferences (theme, language, notifications)
- [ ] Account Settings (email, password link)
- [ ] System Configuration (admin only)
- [ ] Save confirmation
- [ ] Reset to defaults option
- [ ] Form validation

**API Endpoints:**
- `GET /api/export-settings`
- `PUT /api/export-settings`
- `POST /api/export-settings/reset`
- User preferences endpoint (may need backend support)

**Files to Create:**
- `frontend/src/components/SettingsPage.tsx`
- `frontend/src/components/ExportSettings.tsx`
- `frontend/src/components/UserPreferences.tsx`
- `frontend/src/types/settings.ts`
- `frontend/src/styles/Settings.css`

---

### Issue #25: Enhance Achievements System
**Priority:** Low  
**Dependencies:** #3

**Description:**
Extract achievements from analytics tab and create dedicated achievements page.

**Acceptance Criteria:**
- [ ] Create standalone `AchievementsPage.tsx`
- [ ] Display all achievement types with icons
- [ ] Player achievement showcase
- [ ] Team leaderboards
- [ ] Global leaderboards
- [ ] Achievement progress tracking
- [ ] Badge collection display
- [ ] Social sharing buttons
- [ ] Filter by achievement category
- [ ] Search achievements

**Files to Create:**
- `frontend/src/components/AchievementsPage.tsx`
- `frontend/src/components/AchievementGallery.tsx`
- `frontend/src/styles/AchievementsPage.css`

**Files to Modify:**
- `frontend/src/components/ShotAnalytics.tsx` (remove achievements tab, add link)

---

## Cross-Cutting Issues

### Issue #26: Comprehensive Testing Suite
**Priority:** High  
**Dependencies:** All feature issues

**Description:**
Create comprehensive test coverage for all new components.

**Acceptance Criteria:**
- [ ] Unit tests for all new components (80%+ coverage)
- [ ] Integration tests for navigation flows
- [ ] E2E tests for critical user paths
- [ ] Mobile responsiveness tests
- [ ] Accessibility tests (WCAG 2.1 AA compliance)
- [ ] Performance tests (Lighthouse scores)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Update existing tests for navigation changes

**Test Files to Create:**
- `frontend/src/test/Navigation.test.tsx` (update)
- `frontend/src/test/Dashboard.test.tsx`
- `frontend/src/test/ClubManagement.test.tsx`
- `frontend/src/test/CompetitionManagement.test.tsx`
- `frontend/src/test/AdvancedAnalytics.test.tsx`
- `frontend/src/test/ScheduledReports.test.tsx`
- `frontend/cypress/e2e/navigation.cy.ts`
- `frontend/cypress/e2e/competitions.cy.ts`

---

### Issue #27: Documentation Updates
**Priority:** Medium  
**Dependencies:** All feature issues

**Description:**
Update all documentation to reflect new navigation structure and features.

**Acceptance Criteria:**
- [ ] Update README.md with new features
- [ ] Create user guide for new navigation
- [ ] Document all new API client methods
- [ ] Update component documentation
- [ ] Create architecture diagrams
- [ ] Update QUICKSTART.md
- [ ] Add screenshots/GIFs of new features
- [ ] Update CHANGELOG.md

**Files to Update:**
- `README.md`
- `frontend/README.md`
- `QUICKSTART.md`
- `CHANGELOG.md`

**Files to Create:**
- `docs/USER_GUIDE.md`
- `docs/NAVIGATION_GUIDE.md`
- `docs/COMPETITION_MANAGEMENT.md`

---

### Issue #28: Accessibility Audit & Improvements
**Priority:** Medium  
**Dependencies:** #1, all Phase 1 issues

**Description:**
Conduct accessibility audit and implement improvements for WCAG 2.1 AA compliance.

**Acceptance Criteria:**
- [ ] Keyboard navigation for all interactive elements
- [ ] Screen reader compatibility (test with NVDA/JAWS)
- [ ] Proper ARIA labels and roles
- [ ] Focus management in modals/dropdowns
- [ ] Color contrast compliance (4.5:1 minimum)
- [ ] Skip navigation link
- [ ] Semantic HTML structure
- [ ] Form labels and error announcements
- [ ] Alt text for all images
- [ ] No keyboard traps

**Tools to Use:**
- axe DevTools
- WAVE
- Lighthouse
- Screen reader testing

---

### Issue #29: Performance Optimization
**Priority:** Medium  
**Dependencies:** All feature issues

**Description:**
Optimize performance for new navigation and components.

**Acceptance Criteria:**
- [ ] Code splitting for lazy-loaded routes
- [ ] Memoization for expensive computations
- [ ] Virtual scrolling for large lists
- [ ] Image optimization and lazy loading
- [ ] Bundle size analysis and reduction
- [ ] Lighthouse performance score >90
- [ ] First Contentful Paint <1.5s
- [ ] Time to Interactive <3.5s
- [ ] Reduce JavaScript bundle size
- [ ] Implement service worker caching for navigation

**Files to Modify:**
- `frontend/src/App.tsx` (lazy loading)
- `frontend/vite.config.ts` (bundle optimization)
- Various component files (memoization)

---

### Issue #30: Mobile App Integration
**Priority:** Low  
**Dependencies:** All Phase 1-3 issues

**Description:**
Ensure all new features work correctly in Capacitor mobile builds (Android/iOS).

**Acceptance Criteria:**
- [ ] Test navigation on Android devices
- [ ] Test navigation on iOS devices
- [ ] Mobile-specific gesture support (swipe to open menu)
- [ ] Native-like animations
- [ ] Handle mobile keyboard interactions
- [ ] Safe area insets for notched devices
- [ ] Offline functionality for new features
- [ ] Update Capacitor configuration if needed
- [ ] Test on various screen sizes

**Files to Update:**
- `frontend/capacitor.config.ts`
- `frontend/src/styles/main.css` (mobile-specific)


