import React from 'react';

interface ComingSoonProps {
  title: string;
  hint?: string;
}

const ComingSoon: React.FC<ComingSoonProps> = ({ title, hint }) => {
  return (
    <div style={{ padding: 20, maxWidth: 720, margin: '0 auto' }}>
      <h2>{title}</h2>
      <p style={{ marginTop: 12 }}>This feature is coming soon.</p>
      {hint && (
        <p style={{ marginTop: 8, opacity: 0.8 }}>{hint}</p>
      )}
    </div>
  );
};

export default ComingSoon;
