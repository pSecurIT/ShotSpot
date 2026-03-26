export type ReportTemplateType = 'summary' | 'detailed' | 'coach_focused' | 'custom';
export type TemplateSectionType = 'summary' | 'stats' | 'charts' | 'commentary' | 'comparison';
export type MetricKey =
  | 'goals'
  | 'assists'
  | 'total_shots'
  | 'field_goal_percentage'
  | 'possession_duration'
  | 'rebounds'
  | 'turnovers'
  | 'streaks'
  | 'zone_success_rate';
export type ChartType = 'bar' | 'line' | 'pie' | 'heatmap';
export type ChartTimeframe = 'full_match' | 'per_period' | 'last_5_minutes';
export type CommentaryTone = 'neutral' | 'coach' | 'broadcast';
export type ComparisonLayout = 'table' | 'cards';
export type ComparisonTarget = 'team' | 'period' | 'player_group';
export type SummaryEmphasis = 'score' | 'trend' | 'momentum';

export interface TemplateSectionConfig {
  metricIds: MetricKey[];
  columns: 1 | 2 | 3 | 4;
  showComparison: boolean;
  chartType: ChartType;
  timeframe: ChartTimeframe;
  tone: CommentaryTone;
  maxItems: number;
  includeTimestamps: boolean;
  layout: ComparisonLayout;
  compareBy: ComparisonTarget;
  highlightMetric: MetricKey;
  emphasis: SummaryEmphasis;
  showCallout: boolean;
}

export interface ReportTemplateSection {
  id: string;
  type: TemplateSectionType;
  title: string;
  description: string;
  config: TemplateSectionConfig;
}

export interface ReportTemplateDraft {
  id?: number;
  name: string;
  type: ReportTemplateType;
  description: string;
  sections: ReportTemplateSection[];
  metrics: string[];
  is_default?: boolean;
  is_active?: boolean;
  created_by?: number | null;
  created_by_username?: string | null;
  branding?: Record<string, unknown>;
  language?: string;
  date_format?: string;
  time_format?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReportTemplate extends ReportTemplateDraft {
  id: number;
  sections: ReportTemplateSection[];
  metrics: string[];
  is_default: boolean;
  is_active: boolean;
}

export interface ReportTemplatePayload {
  name: string;
  type: ReportTemplateType;
  description?: string;
  sections: ReportTemplateSection[];
  metrics: string[];
  branding?: Record<string, unknown>;
  language?: string;
  date_format?: string;
  time_format?: string;
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

const metricLabels: Record<MetricKey, string> = {
  goals: 'Goals',
  assists: 'Assists',
  total_shots: 'Total Shots',
  field_goal_percentage: 'Field Goal %',
  possession_duration: 'Possession Duration',
  rebounds: 'Rebounds',
  turnovers: 'Turnovers',
  streaks: 'Streaks',
  zone_success_rate: 'Zone Success Rate',
};

export const REPORT_TEMPLATE_TYPE_OPTIONS: Array<SelectOption<ReportTemplateType>> = [
  { value: 'summary', label: 'Summary' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'coach_focused', label: 'Coach Focused' },
  { value: 'custom', label: 'Custom' },
];

export const METRIC_OPTIONS: Array<SelectOption<MetricKey>> = Object.entries(metricLabels).map(([value, label]) => ({
  value: value as MetricKey,
  label,
}));

export const SECTION_TYPE_OPTIONS: Array<SelectOption<TemplateSectionType>> = [
  { value: 'summary', label: 'Summary', description: 'Headline takeaways and featured metric.' },
  { value: 'stats', label: 'Stats Grid', description: 'Core KPIs in a compact layout.' },
  { value: 'charts', label: 'Charts', description: 'Visual trend or distribution section.' },
  { value: 'commentary', label: 'Commentary', description: 'Narrative notes and match talking points.' },
  { value: 'comparison', label: 'Comparison', description: 'Side-by-side team or period comparisons.' },
];

const defaultSectionConfig = (): TemplateSectionConfig => ({
  metricIds: ['goals', 'field_goal_percentage'],
  columns: 2,
  showComparison: true,
  chartType: 'bar',
  timeframe: 'full_match',
  tone: 'neutral',
  maxItems: 3,
  includeTimestamps: true,
  layout: 'table',
  compareBy: 'team',
  highlightMetric: 'goals',
  emphasis: 'score',
  showCallout: true,
});

const sectionDefaults: Record<TemplateSectionType, Omit<ReportTemplateSection, 'id'>> = {
  summary: {
    type: 'summary',
    title: 'Executive Summary',
    description: 'Start the report with a concise match overview.',
    config: {
      ...defaultSectionConfig(),
      metricIds: ['goals', 'field_goal_percentage'],
      highlightMetric: 'goals',
      emphasis: 'score',
    },
  },
  stats: {
    type: 'stats',
    title: 'Stats Grid',
    description: 'Display the key match KPIs.',
    config: {
      ...defaultSectionConfig(),
      metricIds: ['goals', 'assists', 'total_shots', 'field_goal_percentage'],
      columns: 4,
    },
  },
  charts: {
    type: 'charts',
    title: 'Performance Charts',
    description: 'Visualize momentum and shooting trends.',
    config: {
      ...defaultSectionConfig(),
      metricIds: ['goals', 'field_goal_percentage'],
      chartType: 'line',
      timeframe: 'per_period',
    },
  },
  commentary: {
    type: 'commentary',
    title: 'Coach Commentary',
    description: 'Narrative observations and tactical notes.',
    config: {
      ...defaultSectionConfig(),
      metricIds: [],
      tone: 'coach',
      maxItems: 4,
      includeTimestamps: false,
    },
  },
  comparison: {
    type: 'comparison',
    title: 'Comparison Table',
    description: 'Compare performance by team or period.',
    config: {
      ...defaultSectionConfig(),
      metricIds: ['goals', 'total_shots', 'possession_duration'],
      compareBy: 'team',
      layout: 'table',
    },
  },
};

const legacySectionTypeMap: Record<string, TemplateSectionType> = {
  game_info: 'summary',
  final_score: 'summary',
  top_scorers: 'stats',
  team_comparison: 'comparison',
  shot_chart: 'charts',
  player_stats: 'stats',
  period_breakdown: 'comparison',
  possession_stats: 'stats',
  zone_analysis: 'charts',
  substitutions: 'commentary',
  player_performance: 'stats',
  hot_cold_zones: 'charts',
  trends: 'charts',
  streaks: 'charts',
  substitution_impact: 'comparison',
  tactical_notes: 'commentary',
};

const toTitleCase = (value: string) => value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export const getMetricLabel = (metric: string) => metricLabels[metric as MetricKey] || toTitleCase(metric);

export const createTemplateSection = (type: TemplateSectionType): ReportTemplateSection => ({
  id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ...sectionDefaults[type],
  config: {
    ...sectionDefaults[type].config,
    metricIds: [...sectionDefaults[type].config.metricIds],
  },
});

const normalizeMetricIds = (metrics: unknown): MetricKey[] => {
  if (!Array.isArray(metrics)) {
    return [];
  }

  return metrics.filter((metric): metric is MetricKey => typeof metric === 'string');
};

const normalizeConfig = (type: TemplateSectionType, rawConfig: unknown): TemplateSectionConfig => {
  const config = typeof rawConfig === 'object' && rawConfig !== null ? rawConfig as Partial<TemplateSectionConfig> : {};
  const defaults = sectionDefaults[type].config;

  return {
    ...defaults,
    ...config,
    metricIds: normalizeMetricIds(config.metricIds ?? defaults.metricIds),
  };
};

export const normalizeTemplateSection = (rawSection: unknown, index: number): ReportTemplateSection => {
  if (typeof rawSection === 'string') {
    const mappedType = legacySectionTypeMap[rawSection] || 'summary';
    const section = createTemplateSection(mappedType);

    return {
      ...section,
      id: `legacy-${index}-${rawSection}`,
      title: toTitleCase(rawSection),
      description: section.description,
    };
  }

  const sectionObject = typeof rawSection === 'object' && rawSection !== null ? rawSection as Partial<ReportTemplateSection> : {};
  const type = sectionObject.type && SECTION_TYPE_OPTIONS.find((option) => option.value === sectionObject.type)
    ? sectionObject.type
    : 'summary';

  return {
    id: typeof sectionObject.id === 'string' ? sectionObject.id : `normalized-${index}`,
    type,
    title: typeof sectionObject.title === 'string' && sectionObject.title.trim() ? sectionObject.title : sectionDefaults[type].title,
    description: typeof sectionObject.description === 'string' ? sectionObject.description : sectionDefaults[type].description,
    config: normalizeConfig(type, sectionObject.config),
  };
};

export const collectMetricsFromSections = (sections: ReportTemplateSection[]): string[] => {
  const metricSet = new Set<string>();

  sections.forEach((section) => {
    section.config.metricIds.forEach((metric) => metricSet.add(metric));

    if (section.type === 'summary' && section.config.highlightMetric) {
      metricSet.add(section.config.highlightMetric);
    }
  });

  return Array.from(metricSet);
};

export const createEmptyTemplateDraft = (): ReportTemplateDraft => {
  const sections = [createTemplateSection('summary')];

  return {
    name: '',
    type: 'custom',
    description: '',
    sections,
    metrics: collectMetricsFromSections(sections),
    branding: {},
    language: 'en',
    date_format: 'YYYY-MM-DD',
    time_format: '24h',
    is_active: true,
  };
};

export const cloneTemplateDraft = (template?: ReportTemplateDraft | null): ReportTemplateDraft => {
  if (!template) {
    return createEmptyTemplateDraft();
  }

  const sections = template.sections.map((section, index) => normalizeTemplateSection(section, index));

  return {
    ...template,
    description: template.description || '',
    sections,
    metrics: template.metrics?.length ? [...template.metrics] : collectMetricsFromSections(sections),
    branding: { ...(template.branding || {}) },
    language: template.language || 'en',
    date_format: template.date_format || 'YYYY-MM-DD',
    time_format: template.time_format || '24h',
  };
};

export const createDuplicateTemplateDraft = (template: ReportTemplate): ReportTemplateDraft => {
  const draft = cloneTemplateDraft(template);

  return {
    ...draft,
    id: undefined,
    is_default: false,
    name: `${template.name} Copy`,
  };
};

export const normalizeReportTemplate = (rawTemplate: Record<string, unknown>): ReportTemplate => {
  const sections = Array.isArray(rawTemplate.sections)
    ? rawTemplate.sections.map((section, index) => normalizeTemplateSection(section, index))
    : [createTemplateSection('summary')];

  return {
    id: Number(rawTemplate.id),
    name: typeof rawTemplate.name === 'string' ? rawTemplate.name : 'Untitled Template',
    type: (rawTemplate.type as ReportTemplateType) || 'custom',
    description: typeof rawTemplate.description === 'string' ? rawTemplate.description : '',
    sections,
    metrics: Array.isArray(rawTemplate.metrics)
      ? rawTemplate.metrics.filter((metric): metric is string => typeof metric === 'string')
      : collectMetricsFromSections(sections),
    is_default: Boolean(rawTemplate.is_default),
    is_active: rawTemplate.is_active !== false,
    created_by: typeof rawTemplate.created_by === 'number' ? rawTemplate.created_by : null,
    created_by_username: typeof rawTemplate.created_by_username === 'string' ? rawTemplate.created_by_username : null,
    branding: typeof rawTemplate.branding === 'object' && rawTemplate.branding !== null ? rawTemplate.branding as Record<string, unknown> : {},
    language: typeof rawTemplate.language === 'string' ? rawTemplate.language : 'en',
    date_format: typeof rawTemplate.date_format === 'string' ? rawTemplate.date_format : 'YYYY-MM-DD',
    time_format: typeof rawTemplate.time_format === 'string' ? rawTemplate.time_format : '24h',
    created_at: typeof rawTemplate.created_at === 'string' ? rawTemplate.created_at : undefined,
    updated_at: typeof rawTemplate.updated_at === 'string' ? rawTemplate.updated_at : undefined,
  };
};

export const buildReportTemplatePayload = (draft: ReportTemplateDraft): ReportTemplatePayload => ({
  name: draft.name.trim(),
  type: draft.type,
  description: draft.description.trim() || undefined,
  sections: draft.sections.map((section) => ({
    ...section,
    config: {
      ...section.config,
      metricIds: [...section.config.metricIds],
    },
  })),
  metrics: collectMetricsFromSections(draft.sections),
  branding: draft.branding || {},
  language: draft.language || 'en',
  date_format: draft.date_format || 'YYYY-MM-DD',
  time_format: draft.time_format || '24h',
});

export const reorderSections = (sections: ReportTemplateSection[], fromIndex: number, toIndex: number): ReportTemplateSection[] => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= sections.length || toIndex >= sections.length) {
    return sections;
  }

  const nextSections = [...sections];
  const [moved] = nextSections.splice(fromIndex, 1);
  nextSections.splice(toIndex, 0, moved);
  return nextSections;
};