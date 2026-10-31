import { useId } from 'react';
import Field from '../Field/index.jsx';
import './input.scss';

export default function Input({
  id,
  label,
  hint,
  error,
  required = false,
  className = '',
  fieldClassName = '',
  'aria-describedby': externalDescribedBy,
  ...props
}) {
  const generatedId = useId();
  const inputId = id || `form-input-${generatedId}`;

  return (
    <Field id={inputId} label={label} hint={hint} error={error} required={required} className={fieldClassName}>
      {({ describedBy }) => (
        <input
          {...props}
          id={inputId}
          className={`form-control${className ? ` ${className}` : ''}`}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[externalDescribedBy, describedBy].filter(Boolean).join(' ') || undefined}
        />
      )}
    </Field>
  );
}
