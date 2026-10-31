import { useId } from 'react';
import Field from '../Field/index.jsx';
import './checkbox.scss';

export default function Checkbox({
  id,
  label,
  hint,
  error,
  required = false,
  className = '',
  'aria-describedby': externalDescribedBy,
  ...props
}) {
  const generatedId = useId();
  const checkboxId = id || `form-checkbox-${generatedId}`;

  return (
    <Field
      id={checkboxId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className="form-checkbox-field"
    >
      {({ describedBy }) => (
        <input
          {...props}
          id={checkboxId}
          type="checkbox"
          className={`form-control form-checkbox${className ? ` ${className}` : ''}`}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[externalDescribedBy, describedBy].filter(Boolean).join(' ') || undefined}
        />
      )}
    </Field>
  );
}
