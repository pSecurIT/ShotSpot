export type ThemePreference = 'system' | 'light' | 'dark';
export type ThemePaletteId = 'shotspot-blue' | 'emerald-club' | 'sunset-flare' | 'crimson-strike' | 'violet-pulse' | 'graphite-gold';
export type ThemePaletteSelection = ThemePaletteId | 'team-default';

export interface ThemePalette {
  id: ThemePaletteId;
  name: string;
  description: string;
  primary: string;
  secondary: string;
  accent: string;
}

export interface StoredThemeSettings {
  themePreference: ThemePreference;
  paletteSelection: ThemePaletteSelection;
}

export const THEME_PALETTES: Record<ThemePaletteId, ThemePalette> = {
  'shotspot-blue': {
    id: 'shotspot-blue',
    name: 'ShotSpot Blue',
    description: 'Default club look with electric blue and orange energy.',
    primary: '#2962ff',
    secondary: '#00c853',
    accent: '#ff6b1a'
  },
  'emerald-club': {
    id: 'emerald-club',
    name: 'Emerald Club',
    description: 'Green-led team palette with cool navy support.',
    primary: '#0f8f6b',
    secondary: '#1463ff',
    accent: '#f4b740'
  },
  'sunset-flare': {
    id: 'sunset-flare',
    name: 'Sunset Flare',
    description: 'Warm orange-red accents for aggressive matchday branding.',
    primary: '#d94f04',
    secondary: '#8f2d56',
    accent: '#ffb703'
  },
  'crimson-strike': {
    id: 'crimson-strike',
    name: 'Crimson Strike',
    description: 'High-contrast red palette for bold club identity.',
    primary: '#c1121f',
    secondary: '#780000',
    accent: '#fcbf49'
  },
  'violet-pulse': {
    id: 'violet-pulse',
    name: 'Violet Pulse',
    description: 'Cool violet and cyan combination for analytics-heavy teams.',
    primary: '#6d28d9',
    secondary: '#0f766e',
    accent: '#22c55e'
  },
  'graphite-gold': {
    id: 'graphite-gold',
    name: 'Graphite Gold',
    description: 'Neutral charcoal base with gold accents.',
    primary: '#334155',
    secondary: '#0f172a',
    accent: '#d4a017'
  }
};

export const DEFAULT_THEME_PALETTE_ID: ThemePaletteId = 'shotspot-blue';

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function normalizeHex(value: string): string {
  const raw = value.trim().replace('#', '');
  if (raw.length === 3) {
    return raw.split('').map((char) => `${char}${char}`).join('').toLowerCase();
  }
  return raw.toLowerCase();
}

function hexToRgb(hex: string): RgbColor {
  const normalized = normalizeHex(hex);
  const parsed = Number.parseInt(normalized, 16);

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255
  };
}

function rgbToHex(color: RgbColor): string {
  const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

export function rgbString(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

export function mixColors(base: string, target: string, ratio: number): string {
  const left = hexToRgb(base);
  const right = hexToRgb(target);
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  return rgbToHex({
    r: left.r + (right.r - left.r) * clampedRatio,
    g: left.g + (right.g - left.g) * clampedRatio,
    b: left.b + (right.b - left.b) * clampedRatio
  });
}

export function getThemePalette(id: ThemePaletteId): ThemePalette {
  return THEME_PALETTES[id] ?? THEME_PALETTES[DEFAULT_THEME_PALETTE_ID];
}

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function isThemePaletteId(value: string | null | undefined): value is ThemePaletteId {
  return Boolean(value && value in THEME_PALETTES);
}

export function isThemePaletteSelection(value: string | null | undefined): value is ThemePaletteSelection {
  return value === 'team-default' || isThemePaletteId(value);
}

export function buildThemeCssVariables(palette: ThemePalette): Record<string, string> {
  const primaryRgb = rgbString(palette.primary);
  const accentRgb = rgbString(palette.accent);
  const primaryLight = mixColors(palette.primary, '#ffffff', 0.84);
  const accentSoft = mixColors(palette.accent, '#ffffff', 0.82);
  const heroBase = mixColors(palette.primary, '#0f1724', 0.56);
  const heroMid = mixColors(palette.secondary, '#112747', 0.44);
  const heroHigh = mixColors(palette.accent, palette.primary, 0.42);
  const navBase = mixColors(palette.primary, '#08111d', 0.72);
  const navMid = mixColors(palette.secondary, '#112747', 0.52);
  const navHigh = mixColors(palette.accent, palette.primary, 0.35);

  return {
    '--primary-color': palette.primary,
    '--primary-rgb': primaryRgb,
    '--primary-light': primaryLight,
    '--secondary-color': palette.secondary,
    '--accent-color': palette.accent,
    '--accent-soft': accentSoft,
    '--focus-color': palette.primary,
    '--surface-hero': `linear-gradient(135deg, ${heroBase} 0%, ${heroMid} 52%, ${heroHigh} 100%)`,
    '--surface-nav': `linear-gradient(135deg, rgba(${primaryRgb}, 0.92) 0%, rgba(${rgbString(navMid)}, 0.95) 58%, rgba(${accentRgb}, 0.86) 100%)`,
    '--surface-glow': `radial-gradient(circle at top left, rgba(${accentRgb}, 0.16), transparent 40%)`,
    '--shadow-glow': `0 14px 34px rgba(${primaryRgb}, 0.18)`,
    '--chart-series-1': palette.primary,
    '--chart-series-2': palette.accent,
    '--chart-series-3': palette.secondary,
    '--chart-series-4': mixColors(palette.accent, '#f4c95d', 0.55)
  };
}