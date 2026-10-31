import { useId } from 'react';
import './Empty.scss';

function DefaultIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M8 13.5A3.5 3.5 0 0 1 11.5 10h25a3.5 3.5 0 0 1 3.5 3.5v21a3.5 3.5 0 0 1-3.5 3.5h-25A3.5 3.5 0 0 1 8 34.5v-21Z" />
      <path d="m13 31 7-7 5 5 4-4 6 6M16 17h.01" />
    </svg>
  );
}

export default function Empty({
  icon,
  title,
  message,
  description = 'There is nothing to show here right now.',
  children,
  className = '',
}) {
  const generatedId = useId();
  const titleId = `empty-title-${generatedId}`;
  const descriptionId = `empty-description-${generatedId}`;
  const heading = title || message || 'Nothing here yet';

  return (
    <section
      className={`empty-state${className ? ` ${className}` : ''}`}
      role="group"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div className="empty-state-icon" aria-hidden="true">{icon || <DefaultIcon />}</div>
      <h2 className="empty-state-title" id={titleId}>{heading}</h2>
      {description && <div className="empty-state-description" id={descriptionId}>{description}</div>}
      {children && <div className="empty-state-actions">{children}</div>}
    </section>
  );
}
