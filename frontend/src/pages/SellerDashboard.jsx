import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Stat, Spinner, formatMoney } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Chat from '../components/Chat/index.jsx';
import { db } from '../firebase/index.js';
import { getUnreadChatCount, listenToSellerChatRooms } from '../firebase/chat.js';
export default function SellerDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'listings');
  const [listings, setListings] = useState(null);
  const [leads, setLeads] = useState(null);
  const [appts, setAppts] = useState(null);
  const [openChatLead, setOpenChatLead] = useState(null);
  const [chatRooms, setChatRooms] = useState(null);
  const [chatRoomsError, setChatRoomsError] = useState('');
  const [activeChatRoomId, setActiveChatRoomId] = useState(null);
  const load = () => {
    api.get('/properties?mine=1&limit=50').then((r) => setListings(r.data));
    api.get('/interests/received').then((r) => setLeads(r.data));
    api.get('/appointments/mine').then((r) => setAppts(r.data));
  };
  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    setTab(['listings', 'leads', 'viewings', 'chats'].includes(requestedTab) ? requestedTab : 'listings');
  }, [searchParams]);
  useEffect(load, []);
  useEffect(() => {
    try {
      return listenToSellerChatRooms(db, user.id, setChatRooms, (error) => setChatRoomsError(error.message));
    } catch (error) {
      setChatRoomsError(error.message);
      setChatRooms([]);
    }
  }, [user.id]);
  const del = async (id) => {
    if (!confirm('Delete this listing?')) return;
    await api.del(`/properties/${id}`);
    load();
  };
  const markSold = async (id) => { await api.patch(`/properties/${id}/sold`); load(); };
  const setLead = async (id, status) => { await api.patch(`/interests/${id}/status`, { status }); load(); };
  const setAppt = async (id, status) => { await api.patch(`/appointments/${id}/status`, { status }); load(); };
  const selectTab = (nextTab) => {
    setTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === 'listings') nextParams.delete('tab');
    else nextParams.set('tab', nextTab);
    setSearchParams(nextParams, { replace: true });
  };
  if (!listings || !leads || !appts) return <Spinner />;
  const approved = listings.filter((l) => l.status === 'approved').length;
  const pending = listings.filter((l) => l.status === 'pending').length;
  const totalViews = listings.reduce((s, l) => s + (l.views || 0), 0);
  const unreadChatCount = getUnreadChatCount(chatRooms || [], user.id);
  const activeChatRoom = chatRooms?.find((room) => room.id === activeChatRoomId);
  const activeChatLead = activeChatRoom && leads.find((item) => (
    String(item.buyer_id) === activeChatRoom.buyer_id
    && String(item.property_id) === activeChatRoom.product_id
  ));
  return (
    <div className="container">
      <div className="flex between wrap">
        <div>
          <h1 className="page-title">Seller Dashboard</h1>
          <p className="subtle">Manage your listings and buyer leads.</p>
        </div>
        <button className="btn" onClick={() => nav('/seller/new')}>+ New listing</button>
      </div>
      {user.kyc_status !== 'verified' && (
        <div className="alert info">
          You must complete <Link to="/kyc">KYC verification</Link> before you can publish listings.
        </div>
      )}
      <div className="grid cols-4 my-16-24">
        <Stat num={listings.length} label="Listings" />
        <Stat num={approved} label="Approved" color="var(--green)" />
        <Stat num={pending} label="In review" color="var(--amber)" />
        <Stat num={leads.length} label="Buyer leads" color="var(--brand)" />
      </div>
      <div className="tabs">
        {['listings', 'leads', 'viewings', 'chats'].map((t) => (
          <div key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => selectTab(t)}>
            {t === 'listings' ? 'My Listings' : t === 'leads' ? `Leads (${leads.length})` : t === 'viewings' ? `Viewings (${appts.length})` : `Chats (${chatRooms?.length ?? 0})${unreadChatCount ? ` · ${unreadChatCount} new` : ''}`}
          </div>
        ))}
      </div>
      {tab === 'listings' && (
        listings.length === 0 ? <p className="muted">No listings yet.</p> : (
          <div className="table-wrap card p-0">
            <table>
              <thead><tr><th>Title</th><th>Price</th><th>City</th><th>Status</th><th>Views</th><th>Interests</th><th>Actions</th></tr></thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id}>
                    <td><Link to={`/properties/${l.id}`}>{l.title}</Link>
                      {l.status === 'rejected' && l.rejection_reason && <div><small className="badge rejected">{l.rejection_reason}</small></div>}
                    </td>
                    <td>{formatMoney(l.price)}</td>
                    <td>{l.city}</td>
                    <td><Badge value={l.status} /></td>
                    <td>{l.views}</td>
                    <td>{l.interest_count}</td>
                    <td className="flex wrap">
                      <button className="btn small secondary" onClick={() => nav(`/seller/edit/${l.id}`)}>Edit</button>
                      {l.status === 'approved' && <button className="btn small" onClick={() => markSold(l.id)}>Mark sold</button>}
                      <button className="btn small danger" onClick={() => del(l.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {tab === 'leads' && (
        leads.length === 0 ? <p className="muted">No buyer leads yet.</p> : (
          <div className="table-wrap card p-0">
            <table>
              <thead><tr><th>Property</th><th>Buyer</th><th>Contact</th><th>Message</th><th>Status</th><th>Update</th></tr></thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td><Link to={`/properties/${l.property_id}`}>{l.title}</Link></td>
                    <td>{l.buyer_name} {l.buyer_kyc === 'verified' && <Badge value="verified" />}</td>
                    <td><small>{l.buyer_email}<br />{l.buyer_phone || '—'}</small></td>
                    <td className="muted">{l.message || '—'}</td>
                    <td><Badge value={l.status} /></td>
                    <td>
                      <select value={l.status} onChange={(e) => setLead(l.id, e.target.value)}>
                        <option value="new">new</option>
                        <option value="contacted">contacted</option>
                        <option value="negotiating">negotiating</option>
                        <option value="closed">closed</option>
                      </select>
                      <button className="btn small mt-10" onClick={() => setOpenChatLead(openChatLead === l.id ? null : l.id)}>
                        {openChatLead === l.id ? 'Close chat' : 'Chat'}
                      </button>
                      {openChatLead === l.id && (
                        <div className="seller-chat-inline">
                          <Chat
                            db={db}
                            currentUserId={user.id}
                            buyerId={l.buyer_id}
                            sellerId={user.id}
                            productId={l.property_id}
                            otherUserLabel={l.buyer_name}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {tab === 'chats' && (
        <>
          {chatRoomsError && <div className="alert error">{chatRoomsError}</div>}
          {chatRooms === null ? <Spinner /> : chatRooms.length === 0 ? (
            <p className="muted">No buyer chats yet.</p>
          ) : (
            <div className="table-wrap card p-0">
              <table>
                <thead><tr><th>Property</th><th>Buyer</th><th>Last message</th><th>Updated</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {chatRooms.map((room) => {
                    const lead = leads.find((item) => String(item.buyer_id) === room.buyer_id && String(item.property_id) === room.product_id);
                    return (
                      <tr key={room.id}>
                        <td>{lead?.title || `Property #${room.product_id}`}</td>
                        <td>{lead?.buyer_name || `Buyer #${room.buyer_id}`}</td>
                        <td className="muted">{room.last_message || 'No messages yet'}</td>
                        <td>{room.last_updated?.toDate?.().toLocaleString() || 'Just now'}</td>
                        <td>{getUnreadChatCount([room], user.id) > 0 && <span className="badge pending">New</span>}</td>
                        <td>
                          <button className="btn small" onClick={() => setActiveChatRoomId(activeChatRoomId === room.id ? null : room.id)}>
                            {activeChatRoomId === room.id ? 'Close' : 'Open chat'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {activeChatRoom && (
            <div className="mt-20">
              <Chat
                db={db}
                currentUserId={user.id}
                buyerId={activeChatRoom.buyer_id}
                sellerId={activeChatRoom.seller_id}
                productId={activeChatRoom.product_id}
                otherUserLabel={activeChatLead?.buyer_name || `Buyer #${activeChatRoom.buyer_id}`}
              />
            </div>
          )}
        </>
      )}
      {tab === 'viewings' && (
        appts.length === 0 ? <p className="muted">No viewing requests.</p> : (
          <div className="table-wrap card p-0">
            <table>
              <thead><tr><th>Property</th><th>Buyer</th><th>When</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {appts.map((a) => (
                  <tr key={a.id}>
                    <td><Link to={`/properties/${a.property_id}`}>{a.title}</Link></td>
                    <td>{a.buyer_name}{a.buyer_phone ? ` · ${a.buyer_phone}` : ''}</td>
                    <td>{new Date(a.scheduled_at).toLocaleString()}</td>
                    <td><Badge value={a.status} /></td>
                    <td className="flex wrap">
                      {a.status === 'requested' && <button className="btn small green" onClick={() => setAppt(a.id, 'confirmed')}>Confirm</button>}
                      {['requested', 'confirmed'].includes(a.status) && <button className="btn small danger" onClick={() => setAppt(a.id, 'cancelled')}>Cancel</button>}
                      {a.status === 'confirmed' && <button className="btn small" onClick={() => setAppt(a.id, 'completed')}>Complete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
