import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { Spinner } from './components/ui.jsx';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Browse from './pages/Browse.jsx';
import PropertyDetail from './pages/PropertyDetail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import BuyerDashboard from './pages/BuyerDashboard.jsx';
import SellerDashboard from './pages/SellerDashboard.jsx';
import Chats from './pages/Chats.jsx';
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
        <Route path="/buyer" element={<Protected roles={['buyer', 'seller']}><BuyerDashboard /></Protected>} />
        <Route path="/seller" element={<Protected roles={['buyer', 'seller']}><SellerDashboard /></Protected>} />
        <Route path="/chats" element={<Protected roles={['buyer', 'seller']}><Chats /></Protected>} />
        <Route path="/seller/new" element={<Protected roles={['buyer', 'seller']}><PropertyForm /></Protected>} />
        <Route path="/seller/edit/:id" element={<Protected roles={['buyer', 'seller']}><PropertyForm /></Protected>} />
        <Route path="/admin" element={<Protected roles={['admin']}><AdminDashboard /></Protected>} />
        <Route path="*" element={<div className="container"><h2>404 — Page not found</h2><Link to="/">Go home</Link></div>} />
      </Routes>
    </>
  );
}
