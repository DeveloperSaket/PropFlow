import { useId } from 'react';
import Field from '../Field/index.jsx';
import './textarea.scss';

export default function Textarea({
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
  const textareaId = id || `form-textarea-${generatedId}`;

  return (
    <Field id={textareaId} label={label} hint={hint} error={error} required={required} className={fieldClassName}>
      {({ describedBy }) => (
        <textarea
          {...props}
          id={textareaId}
          className={`form-control${className ? ` ${className}` : ''}`}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[externalDescribedBy, describedBy].filter(Boolean).join(' ') || undefined}
        />
      )}
    </Field>
  );
}
