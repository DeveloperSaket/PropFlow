import './field.scss';

export default function Field({ id, label, hint, error, required, className = '', children }) {
  const describedBy = [
    hint ? `${id}-hint` : null,
    error ? `${id}-error` : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`field form-field${className ? ` ${className}` : ''}`}>
      {label && (
        <label className="form-label" htmlFor={id}>
          {label}{required && <span aria-hidden="true"> *</span>}
        </label>
      )}
      {children({ describedBy })}
      {hint && <small className="form-hint" id={`${id}-hint`}>{hint}</small>}
      {error && <small className="form-error" id={`${id}-error`} role="alert">{error}</small>}
    </div>
  );
}
