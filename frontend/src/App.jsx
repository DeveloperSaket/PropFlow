import { Routes, Route, Navigate, NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { Spinner } from './components/ui.jsx';
import Home from './pages/Home.jsx';
import Browse from './pages/Browse.jsx';
import PropertyDetail from './pages/PropertyDetail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import BuyerDashboard from './pages/BuyerDashboard.jsx';
import SellerDashboard from './pages/SellerDashboard.jsx';
import PropertyForm from './pages/PropertyForm.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Kyc from './pages/Kyc.jsx';
function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const doLogout = () => { logout(); nav('/'); };
  return (
    <nav className="nav">
      <Link to="/" className="brand">Prop<span>Flow</span></Link>
      <NavLink to="/browse">Browse</NavLink>
      {user?.role === 'buyer' && <NavLink to="/buyer">My Dashboard</NavLink>}
      {user?.role === 'seller' && <NavLink to="/seller">Seller Dashboard</NavLink>}
      {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
      {user && user.role !== 'admin' && <NavLink to="/kyc">Compliance</NavLink>}
      <span className="spacer" />
      {user ? (
        <>
          <span className="pill">{user.name} · {user.role}</span>
          <a onClick={doLogout} className="cursor-pointer">Logout</a>
        </>
      ) : (
        <>
          <NavLink to="/login">Login</NavLink>
          <Link to="/register" className="btn small">Sign up</Link>
        </>
      )}
    </nav>
  );
}
export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/properties/:id" element={<PropertyDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/kyc" element={<Protected roles={['buyer', 'seller']}><Kyc /></Protected>} />
        <Route path="/buyer" element={<Protected roles={['buyer']}><BuyerDashboard /></Protected>} />
        <Route path="/seller" element={<Protected roles={['seller']}><SellerDashboard /></Protected>} />
        <Route path="/seller/new" element={<Protected roles={['seller']}><PropertyForm /></Protected>} />
        <Route path="/seller/edit/:id" element={<Protected roles={['seller']}><PropertyForm /></Protected>} />
        <Route path="/admin" element={<Protected roles={['admin']}><AdminDashboard /></Protected>} />
        <Route path="*" element={<div className="container"><h2>404 — Page not found</h2><Link to="/">Go home</Link></div>} />
      </Routes>
    </>
  );
}
