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
}

export const navigationConfig: NavigationItem[] = [
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
      {
        label: 'All Games',
        path: '/games',
        icon: '📋',
        roles: ['user', 'coach', 'admin']
      },
      {
        label: 'Live Match',
        // Live match requires selecting a game first; keep navigation working.
        path: '/match',
        icon: '⚡',
        roles: ['user', 'coach', 'admin']
      },
      {
        label: 'Match Templates',
        path: '/templates',
        icon: '📝',
        roles: ['coach', 'admin']
      }
    ]
  },
  {
    label: 'Analytics',
    icon: '📊',
    roles: ['user', 'coach', 'admin'],
    children: [
      {
        label: 'Match Analytics',
        path: '/analytics',
        icon: '🎯',
        roles: ['user', 'coach', 'admin']
      },
      {
        label: 'Achievements',
        path: '/achievements',
        icon: '🏆',
        roles: ['user', 'coach', 'admin']
      },
      {
        label: 'Advanced Analytics',
        path: '/advanced-analytics',
        icon: '📈',
        roles: ['coach', 'admin'],
        badge: 'Soon',
        disabled: true
      },
      {
        label: 'Team Analytics',
        path: '/team-analytics',
        icon: '👥',
        roles: ['coach', 'admin'],
        badge: 'Soon',
        disabled: true
      }
    ]
  },
  {
    label: 'Data',
    icon: '🗂️',
    roles: ['user', 'coach', 'admin'],
    children: [
      {
        label: 'Players',
        path: '/players',
        icon: '👥',
        roles: ['user', 'coach', 'admin']
      },
      {
        label: 'Teams',
        path: '/teams',
        icon: '🏃',
        roles: ['user', 'coach', 'admin']
      },
      {
        label: 'Clubs',
        path: '/clubs',
        icon: '🏢',
        roles: ['coach', 'admin']
      },
      {
        label: 'Competitions',
        path: '/competitions',
        icon: '🏁',
        roles: ['coach', 'admin'],
        badge: 'Soon',
        disabled: true
      },
      {
        label: 'Series/Divisions',
        path: '/series',
        icon: '🗓️',
        roles: ['coach', 'admin'],
        badge: 'Soon',
        disabled: true
      }
    ]
  },
  {
    label: 'Settings',
    icon: '⚙️',
    roles: ['coach', 'admin'],
    children: [
      {
        label: 'Export Center',
        path: '/exports',
        icon: '📤',
        roles: ['coach', 'admin']
      },
      {
        label: 'Report Templates',
        path: '/report-templates',
        icon: '📄',
        roles: ['coach', 'admin'],
        badge: 'Soon',
        disabled: true
      },
      {
        label: 'Scheduled Reports',
        path: '/scheduled-reports',
        icon: '⏰',
        roles: ['coach', 'admin'],
        badge: 'Soon',
        disabled: true
      },
      {
        label: 'Export Settings',
        path: '/export-settings',
        icon: '⚙️',
        roles: ['coach', 'admin'],
        badge: 'Soon',
        disabled: true
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
        roles: ['coach', 'admin']
      },
      {
        label: 'User Management',
        path: '/users',
        icon: '👥',
        roles: ['admin']
      }
    ]
  }
];

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024
} as const;
