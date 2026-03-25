import React from 'react';

interface TimeSchedulePickerProps {
  hour: number;
  minute: number;
  onChange: (next: { hour: number; minute: number }) => void;
  disabled?: boolean;
  label?: string;
}

const hours = Array.from({ length: 24 }, (_, hour) => hour);
const minutes = Array.from({ length: 60 }, (_, minute) => minute);

const TimeSchedulePicker: React.FC<TimeSchedulePickerProps> = ({
  hour,
  minute,
  onChange,
  disabled = false,
  label = 'Execution Time',
}) => {
  return (
    <fieldset className="scheduled-reports-form__fieldset" aria-label={label}>
      <legend>{label}</legend>
      <div className="scheduled-reports-form__inline-fields">
        <label className="scheduled-reports-form__field">
          <span>Hour</span>
          <select
            value={hour}
            onChange={(event) => onChange({ hour: Number(event.target.value), minute })}
            disabled={disabled}
          >
            {hours.map((value) => (
              <option key={value} value={value}>
                {value.toString().padStart(2, '0')}
              </option>
            ))}
          </select>
        </label>

        <label className="scheduled-reports-form__field">
          <span>Minute</span>
          <select
            value={minute}
            onChange={(event) => onChange({ hour, minute: Number(event.target.value) })}
            disabled={disabled}
          >
            {minutes.map((value) => (
              <option key={value} value={value}>
                {value.toString().padStart(2, '0')}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
};

export default TimeSchedulePicker;
