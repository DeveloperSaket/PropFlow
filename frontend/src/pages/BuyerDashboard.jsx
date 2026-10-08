import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Stat, Spinner, formatMoney } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Chat from '../components/Chat/index.jsx';
import { db } from '../firebase/index.js';
import { getUnreadChatCount, listenToBuyerChatRooms } from '../firebase/chat.js';
export default function BuyerDashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get('tab') === 'chats' ? 'chats' : 'overview');
  const [interests, setInterests] = useState(null);
  const [appts, setAppts] = useState(null);
  const [chatRooms, setChatRooms] = useState(null);
  const [chatRoomsError, setChatRoomsError] = useState('');
  const [activeChatRoomId, setActiveChatRoomId] = useState(null);
  const [chatProperties, setChatProperties] = useState({});
  const load = () => {
    api.get('/interests/mine').then((r) => setInterests(r.data));
    api.get('/appointments/mine?view=buyer').then((r) => setAppts(r.data));
  };
  useEffect(load, []);
  useEffect(() => {
    setTab(searchParams.get('tab') === 'chats' ? 'chats' : 'overview');
  }, [searchParams]);
  useEffect(() => {
    try {
      return listenToBuyerChatRooms(db, user.id, setChatRooms, (error) => setChatRoomsError(error.message));
    } catch (error) {
      setChatRoomsError(error.message);
      setChatRooms([]);
    }
  }, [user.id]);
  const chatPropertyIds = chatRooms?.map((room) => room.product_id).join(',') || '';
  useEffect(() => {
    if (!chatRooms?.length) {
      setChatProperties({});
      return undefined;
    }
    let active = true;
    Promise.all(chatRooms.map(async (room) => {
      try {
        const response = await api.get(`/properties/${room.product_id}`);
        return [room.id, response.data];
      } catch {
        return [room.id, null];
      }
    })).then((entries) => {
      if (active) setChatProperties(Object.fromEntries(entries));
    });
    return () => { active = false; };
  }, [chatPropertyIds]);
  const withdraw = async (id) => {
    await api.patch(`/interests/${id}/status`, { status: 'withdrawn' });
    load();
  };
  const cancelAppt = async (id) => {
    await api.patch(`/appointments/${id}/status`, { status: 'cancelled' });
    load();
  };
  if (!interests || !appts) return <Spinner />;
  const active = interests.filter((i) => i.status !== 'withdrawn' && i.status !== 'closed').length;
  const upcoming = appts.filter((a) => ['requested', 'confirmed'].includes(a.status)).length;
  const unreadChatCount = getUnreadChatCount(chatRooms || [], user.id);
  const activeChatRoom = chatRooms?.find((room) => room.id === activeChatRoomId);
  const selectTab = (nextTab) => {
    setTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === 'overview') nextParams.delete('tab');
    else nextParams.set('tab', nextTab);
    setSearchParams(nextParams, { replace: true });
  };
  return (
    <div className="container">
      <h1 className="page-title">Welcome, {user.name}</h1>
      <p className="subtle">Track your property interests and viewings.</p>
      <div className="tabs">
        <button type="button" className={`tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => selectTab('overview')}>Overview</button>
        <button type="button" className={`tab ${tab === 'chats' ? 'active' : ''}`} onClick={() => selectTab('chats')}>
          Chats ({chatRooms?.length ?? 0}){unreadChatCount ? ` · ${unreadChatCount} new` : ''}
        </button>
      </div>
      {tab === 'overview' && <>
      <div className="grid cols-4 mb-24">
        <Stat num={interests.length} label="Total interests" />
        <Stat num={active} label="Active" color="var(--brand)" />
        <Stat num={upcoming} label="Upcoming viewings" color="var(--green)" />
        <Stat num={user.kyc_status === 'verified' ? '✓' : '…'} label={`KYC ${user.kyc_status}`} />
      </div>
      {user.kyc_status !== 'verified' && (
        <div className="alert info">
          Complete your <Link to="/kyc">KYC verification</Link> to build trust with sellers.
        </div>
      )}
      <h2>My interests</h2>
      {interests.length === 0 ? (
        <p className="muted">You haven't expressed interest in any property yet. <Link to="/browse">Browse listings →</Link></p>
      ) : (
        <div className="table-wrap card p-0 mb-30">
          <table>
            <thead><tr><th>Property</th><th>Price</th><th>Seller</th><th>Status</th><th>Since</th><th></th></tr></thead>
            <tbody>
              {interests.map((i) => (
                <tr key={i.id}>
                  <td><Link to={`/properties/${i.property_id}`}>{i.title}</Link><br /><small className="muted">{i.city} · {i.property_type}</small></td>
                  <td>{formatMoney(i.price)}</td>
                  <td>{i.seller_name}</td>
                  <td><Badge value={i.status} /></td>
                  <td className="muted">{i.created_at}</td>
                  <td>
                    {i.status !== 'withdrawn' && i.status !== 'closed' && (
                      <button className="btn small secondary" onClick={() => withdraw(i.id)}>Withdraw</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2>My viewings</h2>
      {appts.length === 0 ? (
        <p className="muted">No viewings scheduled.</p>
      ) : (
        <div className="table-wrap card p-0">
          <table>
            <thead><tr><th>Property</th><th>When</th><th>Seller</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {appts.map((a) => (
                <tr key={a.id}>
                  <td><Link to={`/properties/${a.property_id}`}>{a.title}</Link></td>
                  <td>{new Date(a.scheduled_at).toLocaleString()}</td>
                  <td>{a.seller_name}{a.seller_phone ? ` · ${a.seller_phone}` : ''}</td>
                  <td><Badge value={a.status} /></td>
                  <td>
                    {['requested', 'confirmed'].includes(a.status) && (
                      <button className="btn small danger" onClick={() => cancelAppt(a.id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>}
      {tab === 'chats' && (
        <>
          {chatRoomsError && <div className="alert error">{chatRoomsError}</div>}
          {chatRooms === null ? <Spinner /> : chatRooms.length === 0 ? (
            <p className="muted">No conversations yet. <Link to="/browse">Browse properties</Link> to contact a seller.</p>
          ) : (
            <div className="table-wrap card p-0">
              <table>
                <thead><tr><th>Property</th><th>Seller</th><th>Last message</th><th>Updated</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {chatRooms.map((room) => {
                    const property = chatProperties[room.id];
                    return (
                      <tr key={room.id}>
                        <td>{property?.title || `Property #${room.product_id}`}</td>
                        <td>{property?.seller_name || `Seller #${room.seller_id}`}</td>
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
                otherUserLabel={chatProperties[activeChatRoom.id]?.seller_name || `Seller #${activeChatRoom.seller_id}`}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
