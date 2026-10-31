import { useId } from 'react';
import Field from '../Field/index.jsx';
import './select.scss';

export default function Select({
  id,
  label,
  hint,
  error,
  required = false,
  className = '',
  fieldClassName = '',
  'aria-describedby': externalDescribedBy,
  children,
  ...props
}) {
  const generatedId = useId();
  const selectId = id || `form-select-${generatedId}`;

  return (
    <Field id={selectId} label={label} hint={hint} error={error} required={required} className={fieldClassName}>
      {({ describedBy }) => (
        <select
          {...props}
          id={selectId}
          className={`form-control${className ? ` ${className}` : ''}`}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[externalDescribedBy, describedBy].filter(Boolean).join(' ') || undefined}
        >
          {children}
        </select>
      )}
    </Field>
  );
}
