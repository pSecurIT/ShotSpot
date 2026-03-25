import React from 'react';
import ScheduleConfigForm from './ScheduleConfigForm';
import type {
  ReportTemplateOption,
  ScheduledReport,
  ScheduledReportPayload,
  TeamOption,
} from '../types/scheduled-reports';

interface ReportScheduleDialogProps {
  isOpen: boolean;
  templates: ReportTemplateOption[];
  teams: TeamOption[];
  initialSchedule?: ScheduledReport | null;
  onClose: () => void;
  onSave: (payload: ScheduledReportPayload, id?: number) => Promise<void>;
}

const ReportScheduleDialog: React.FC<ReportScheduleDialogProps> = ({
  isOpen,
  templates,
  teams,
  initialSchedule,
  onClose,
  onSave,
}) => {
  const title = initialSchedule ? 'Edit Scheduled Report' : 'Create Scheduled Report';

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (payload: ScheduledReportPayload, id?: number) => {
    await onSave(payload, id);
    onClose();
  };

  return (
    <div className="scheduled-reports-modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="scheduled-reports-modal">
        <div className="scheduled-reports-modal__header">
          <h3>{title}</h3>
          <button
            type="button"
            className="scheduled-reports-modal__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            x
          </button>
        </div>

        <ScheduleConfigForm
          templates={templates}
          teams={teams}
          initialSchedule={initialSchedule}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      </div>
    </div>
  );
};

export default ReportScheduleDialog;
