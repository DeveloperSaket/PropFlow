import Input from '../Input/index.jsx';
import './file-input.scss';

export default function FileInput(props) {
  return <Input {...props} type="file" />;
}
