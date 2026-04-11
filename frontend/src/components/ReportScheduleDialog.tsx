import React, { useRef } from 'react';
import ScheduleConfigForm from './ScheduleConfigForm';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { dialogRef, titleId, onDialogKeyDown } = useAccessibleDialog({
    isOpen,
    onClose,
    initialFocusRef: closeButtonRef,
  });

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (payload: ScheduledReportPayload, id?: number) => {
    await onSave(payload, id);
    onClose();
  };

  return (
    <div
      className="scheduled-reports-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="scheduled-reports-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onDialogKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <div className="scheduled-reports-modal__header">
          <h3 id={titleId}>{title}</h3>
          <button
            ref={closeButtonRef}
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
