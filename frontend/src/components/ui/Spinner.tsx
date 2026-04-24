import React from 'react';

type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '' }) => {
  const classes = ['feedback-spinner', `feedback-spinner--${size}`, className].filter(Boolean).join(' ');

  return <span className={classes} aria-hidden="true" />;
};

export default Spinner;