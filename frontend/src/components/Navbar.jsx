import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { db } from '../firebase/index.js';
import { getUnreadChatCount, listenToBuyerChatRooms, listenToSellerChatRooms } from '../firebase/chat.js';
import './Navbar.scss';

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!user || user.role === 'admin') {
      setUnreadChatCount(0);
      return undefined;
    }

    try {
      let buyerRooms = [];
      let sellerRooms = [];
      const updateUnreadCount = () => setUnreadChatCount(
        getUnreadChatCount(buyerRooms, user.id) + getUnreadChatCount(sellerRooms, user.id),
      );
      const unsubscribeBuyer = listenToBuyerChatRooms(db, user.id, (rooms) => {
        buyerRooms = rooms;
        updateUnreadCount();
      }, () => {
        buyerRooms = [];
        updateUnreadCount();
      });
      const unsubscribeSeller = listenToSellerChatRooms(db, user.id, (rooms) => {
        sellerRooms = rooms;
        updateUnreadCount();
      }, () => {
        sellerRooms = [];
        updateUnreadCount();
      });
      return () => {
        unsubscribeBuyer();
        unsubscribeSeller();
      };
    } catch {
      setUnreadChatCount(0);
      return undefined;
    }
  }, [user?.id, user?.role]);

  const doLogout = () => { logout(); nav('/'); };

  return (
    <nav className="nav">
      <Link to="/" className="brand">Prop<span>Flow</span></Link>
      <button
        className="nav-menu-toggle"
        type="button"
        aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={mobileMenuOpen}
        aria-controls="primary-navigation"
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
      <div id="primary-navigation" className={`nav-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="nav-links" onClick={() => setMobileMenuOpen(false)}>
          <NavLink to="/browse">Browse</NavLink>
          {user && user.role !== 'admin' && <NavLink to="/buyer">Buying</NavLink>}
          {user && user.role !== 'admin' && <NavLink to="/seller" end>Selling</NavLink>}
          {user && user.role !== 'admin' && (
            <NavLink to="/chats">
              Chats{unreadChatCount > 0 && <span className="nav-unread" aria-label={`${unreadChatCount} unread chats`}>{unreadChatCount > 9 ? '9+' : unreadChatCount}</span>}
            </NavLink>
          )}
          {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
          {user && user.role !== 'admin' && <NavLink to="/kyc">Compliance</NavLink>}
        </div>
        <span className="spacer" />
        <div className="nav-actions" onClick={() => setMobileMenuOpen(false)}>
          {user ? (
            <>
              <span className="pill">
                {user.name} · {user.role === 'admin' ? 'Admin' : 'Buyer & Seller'}
                {user.is_agent && ' · Agent'}
              </span>
              <a onClick={doLogout} className="cursor-pointer">Logout</a>
            </>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <Link to="/register" className="btn small">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}