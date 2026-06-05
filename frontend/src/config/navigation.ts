/**
 * Navigation Configuration
 * Defines the complete navigation structure with role-based access control
 */

export interface NavigationItem {
  label: string;
  path?: string;
  icon: string;
  roles: ('user' | 'coach' | 'admin')[];
  children?: NavigationItem[];
  onClick?: () => void;
  badge?: string;
  divider?: boolean;
  disabled?: boolean;
  description?: string;
  breadcrumbLabel?: string;
  category?: 'matches' | 'analytics' | 'data' | 'settings' | 'user';
}

export const navigationConfig: NavigationItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: '🏠',
    roles: ['user', 'coach', 'admin'],
    breadcrumbLabel: 'Dashboard'
  },
  {
    label: 'Matches',
    icon: '🎮',
    roles: ['user', 'coach', 'admin'],
    description: 'Games, live capture, and templates',
    category: 'matches',
    children: [
      {
        label: 'All Games',
        path: '/games',
        icon: '📋',
        roles: ['user', 'coach', 'admin'],
        breadcrumbLabel: 'Games',
        category: 'matches'
      },
      {
        label: 'Live Match',
        // Live match requires selecting a game first; keep navigation working.
        path: '/match',
        icon: '⚡',
        roles: ['user', 'coach', 'admin'],
        category: 'matches'
      },
      {
        label: 'Match Templates',
        path: '/templates',
        icon: '📝',
        roles: ['coach', 'admin'],
        category: 'matches'
      }
    ]
  },
  {
    label: 'Analytics',
    icon: '📊',
    roles: ['user', 'coach', 'admin'],
    description: 'Insights, trends, and performance',
    category: 'analytics',
    children: [
      {
        label: 'Match Analytics',
        path: '/analytics',
        icon: '🎯',
        roles: ['user', 'coach', 'admin'],
        category: 'analytics'
      },
      {
        label: 'Achievements',
        path: '/achievements',
        icon: '🏆',
        roles: ['user', 'coach', 'admin'],
        category: 'analytics'
      },
      {
        label: 'Advanced Analytics',
        path: '/advanced-analytics',
        icon: '📈',
        roles: ['coach', 'admin'],
        description: 'Predictions, fatigue, and video insights',
        category: 'analytics'
      },
      {
        label: 'Team Analytics',
        path: '/team-analytics',
        icon: '👥',
        roles: ['coach', 'admin'],
        category: 'analytics'
      },
      {
        label: 'UX Observability',
        path: '/ux-observability',
        icon: '🧭',
        roles: ['admin'],
        description: 'Flow timing, latency impact, and friction signals',
        category: 'analytics'
      }
    ]
  },
  {
    label: 'Data',
    icon: '🗂️',
    roles: ['user', 'coach', 'admin'],
    description: 'Manage players, teams, and competitions',
    category: 'data',
    children: [
      {
        label: 'Players',
        path: '/players',
        icon: '👥',
        roles: ['user', 'coach', 'admin'],
        category: 'data'
      },
      {
        label: 'Teams',
        path: '/teams',
        icon: '🏃',
        roles: ['user', 'coach', 'admin'],
        category: 'data'
      },
      {
        label: 'Clubs',
        path: '/clubs',
        icon: '🏢',
        roles: ['coach', 'admin'],
        category: 'data'
      },
      {
        label: 'Competitions',
        path: '/competitions',
        icon: '🏁',
        roles: ['coach', 'admin'],
        category: 'data'
      },
      {
        label: 'Series/Divisions',
        path: '/series',
        icon: '🗓️',
        roles: ['coach', 'admin'],
        category: 'data'
      }
    ]
  },
  {
    label: 'Settings',
    icon: '⚙️',
    roles: ['user', 'coach', 'admin'],
    description: 'Configuration, notifications, exports, and integrations',
    category: 'settings',
    children: [
      {
        label: 'Export Center',
        path: '/exports',
        icon: '📤',
        roles: ['coach', 'admin'],
        category: 'settings'
      },
      {
        label: 'Report Templates',
        path: '/report-templates',
        icon: '📄',
        roles: ['coach', 'admin'],
        description: 'Customize report formats and sections',
        category: 'settings'
      },
      {
        label: 'Scheduled Reports',
        path: '/scheduled-reports',
        icon: '⏰',
        roles: ['coach', 'admin'],
        category: 'settings'
      },
      {
        label: 'Settings',
        path: '/settings',
        icon: '⚙️',
        roles: ['user', 'coach', 'admin'],
        category: 'settings'
      },
      {
        label: 'settings-divider',
        icon: '',
        roles: ['coach', 'admin'],
        divider: true
      },
      {
        label: 'Twizzit Integration',
        path: '/twizzit',
        icon: '🔗',
        roles: ['coach', 'admin'],
        category: 'settings'
      },
      {
        label: 'User Management',
        path: '/users',
        icon: '👥',
        roles: ['admin'],
        category: 'settings'
      }
    ]
  }
];

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024
} as const;
