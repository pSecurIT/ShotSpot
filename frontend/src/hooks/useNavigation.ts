import { useMemo } from 'react';
import { navigationConfig, NavigationItem } from '../config/navigation';
import type { User } from '../types/auth';

export type Role = 'user' | 'coach' | 'admin';

const isRole = (role: string): role is Role => role === 'user' || role === 'coach' || role === 'admin';

const isAdminOnly = (item: NavigationItem): boolean => item.roles.length === 1 && item.roles[0] === 'admin';

const withAdminIndicator = (item: NavigationItem): NavigationItem => {
  if (!isAdminOnly(item)) return item;
  return {
    ...item,
    badge: item.badge ?? 'Admin'
  };
};

const cleanupDividers = (items: NavigationItem[]): NavigationItem[] => {
  const cleaned: NavigationItem[] = [];

  for (const item of items) {
    if (item.divider) {
      if (cleaned.length === 0) continue;
      if (cleaned[cleaned.length - 1]?.divider) continue;
      cleaned.push(item);
      continue;
    }

    cleaned.push(item);
  }

  while (cleaned.length > 0 && cleaned[cleaned.length - 1]?.divider) {
    cleaned.pop();
  }

  return cleaned;
};

const filterTreeByRole = (items: NavigationItem[], role: Role): NavigationItem[] => {
  const filtered = items
    .filter((item) => item.roles.includes(role))
    .map((item) => {
      const next = withAdminIndicator(item);
      const children = next.children ? filterTreeByRole(next.children, role) : undefined;

      return {
        ...next,
        children
      };
    })
    .filter((item) => Boolean(item.divider || item.path || item.onClick || (item.children && item.children.length > 0)));

  return cleanupDividers(filtered);
};

export const useNavigation = (user: User | null) => {
  const role: Role | null = user && isRole(user.role) ? user.role : null;

  const visibleNavigation = useMemo(() => {
    if (!role) return [];
    return filterTreeByRole(navigationConfig, role);
  }, [role]);

  return {
    role,
    visibleNavigation,
    isAdminOnly
  };
};
