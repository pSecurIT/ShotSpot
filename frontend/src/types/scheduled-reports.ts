export type ScheduleType = 'after_match' | 'weekly' | 'monthly' | 'season_end';

export type ReportFormat = 'json' | 'csv' | 'pdf';

export interface ScheduleOptions {
  weeklyDay: number;
  monthlyDay: number;
  hour: number;
  minute: number;
}

export interface ScheduledReportGameFilters {
  schedule_options?: Partial<ScheduleOptions>;
  [key: string]: unknown;
}

export interface ScheduledReport {
  id: number;
  name: string;
  created_by: number;
  template_id: number;
  schedule_type: ScheduleType;
  is_active: boolean;
  team_id: number | null;
  game_filters: ScheduledReportGameFilters;
  send_email: boolean;
  email_recipients: string[];
  email_subject: string | null;
  email_body: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
  template_name?: string;
  team_name?: string;
  created_by_username?: string;
}

export interface ReportTemplateOption {
  id: number;
  name: string;
  type: string;
  is_default: boolean;
  is_active: boolean;
}

export interface TeamOption {
  id: number;
  name: string;
}

export interface ScheduledReportPayload {
  name: string;
  template_id: number;
  schedule_type: ScheduleType;
  team_id?: number | null;
  game_filters?: ScheduledReportGameFilters;
  send_email?: boolean;
  email_recipients?: string[];
  email_subject?: string;
  email_body?: string;
}

export interface ScheduledReportExecution {
  id: number;
  report_name: string;
  report_type: string;
  format: ReportFormat;
  created_at: string;
}

export interface ScheduledReportRunResponse {
  message: string;
  execution: ScheduledReportExecution;
  next_run_at: string | null;
}

export interface ScheduledReportHistoryEntry {
  id: number;
  report_name: string;
  report_type: string;
  format: ReportFormat;
  file_path: string | null;
  file_size_bytes: number | null;
  access_count: number;
  created_at: string;
  generated_by: number;
  generated_by_username: string | null;
  status: 'queued' | 'completed';
}

export interface ScheduledReportHistoryResponse {
  history: ScheduledReportHistoryEntry[];
}
