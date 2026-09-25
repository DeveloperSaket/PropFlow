import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert } from '../components/ui.jsx';
const dest = { buyer: '/buyer', seller: '/seller', admin: '/admin' };
export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const u = await login(email, password);
      nav(dest[u.role] || '/');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const quick = (em) => { setEmail(em); setPassword(em.includes('admin') ? 'Admin@12345' : 'Password@123'); };
  return (
    <div className="container max-width-440">
      <h1 className="page-title">Log in</h1>
      <p className="subtle">Welcome back to PropFlow.</p>
      <form className="card" onSubmit={submit}>
        <Alert type="error">{err}</Alert>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <p className="muted center mt-14">
          No account? <Link to="/register">Sign up</Link>
        </p>
      </form>
      <div className="card mt-16">
        <strong>Demo accounts</strong>
        <p className="muted font-size-13">Click to autofill, then press Log in:</p>
        <div className="flex wrap">
          <button className="btn small secondary" onClick={() => quick('admin@propflow.test')}>Admin</button>
          <button className="btn small secondary" onClick={() => quick('ravi@seller.test')}>Seller</button>
          <button className="btn small secondary" onClick={() => quick('anita@buyer.test')}>Buyer</button>
        </div>
      </div>
    </div>
  );
}
