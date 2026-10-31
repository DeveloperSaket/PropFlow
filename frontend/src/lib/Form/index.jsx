import './form.scss';

export { default as Input } from './Input/index.jsx';
export { default as Select } from './Select/index.jsx';
export { default as Textarea } from './Textarea/index.jsx';
export { default as Checkbox } from './Checkbox/index.jsx';
export { default as PhoneInput } from './PhoneInput/index.jsx';
export { default as FileInput } from './FileInput/index.jsx';

export default function Form({ className = '', children, ...props }) {
  return <form className={`form${className ? ` ${className}` : ''}`} {...props}>{children}</form>;
}
