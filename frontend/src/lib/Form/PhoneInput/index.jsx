import Input from '../Input/index.jsx';
import './phone-input.scss';

const CANADIAN_PHONE_PATTERN =
  '(?:\\+?1[ .-]?)?(?:\\([2-9][0-9]{2}\\)|[2-9][0-9]{2})[ .-]?[2-9][0-9]{2}[ .-]?[0-9]{4}';

export default function PhoneInput({ pattern, title, ...props }) {
  return (
    <Input
      {...props}
      type="tel"
      autoComplete="tel"
      inputMode="tel"
      pattern={pattern || CANADIAN_PHONE_PATTERN}
      title={title || 'Enter a valid Canadian phone number, such as (416) 555-0123.'}
      placeholder={props.placeholder || '(416) 555-0123'}
    />
  );
}
