import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { appointmentQueries, interestQueries, propertyQueries, queryKeys } from '../api/queries.js';
import { useMutation, useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Stat, formatMoney } from '../components/ui.jsx';
import Spinner from '../lib/Spinner/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import Chat from '../components/Chat/index.jsx';
import { db } from '../firebase/index.js';
import { getUnreadChatCount, listenToBuyerChatRooms } from '../firebase/chat.js';
export default function BuyerDashboard() {
  const { user, chatAvailable, firebaseError } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get('tab') === 'chats' ? 'chats' : 'overview');
  const queryClient = useQueryClient();
  const { data: interests, isPending: interestsPending, error: interestsError } = useQuery({
    queryKey: queryKeys.interests.mine(user.id),
    queryFn: interestQueries.mine,
  });
  const { data: appts, isPending: appointmentsPending, error: appointmentsError } = useQuery({
    queryKey: queryKeys.appointments.mine(user.id, 'buyer'),
    queryFn: ({ signal }) => appointmentQueries.mine('buyer', { signal }),
  });
  const [chatRooms, setChatRooms] = useState(null);
  const [chatRoomsError, setChatRoomsError] = useState('');
  const [activeChatRoomId, setActiveChatRoomId] = useState(null);
  const chatPropertyQueries = useQueries({
    queries: (chatRooms || []).map((room) => ({
      queryKey: queryKeys.properties.detail(room.product_id),
      queryFn: ({ signal }) => propertyQueries.detail(room.product_id, { signal }),
      enabled: Boolean(chatRooms),
    })),
  });
  const chatProperties = Object.fromEntries((chatRooms || []).map((room, index) => [
    room.id,
    chatPropertyQueries[index]?.data || null,
  ]));
  useEffect(() => {
    setTab(searchParams.get('tab') === 'chats' ? 'chats' : 'overview');
  }, [searchParams]);
  useEffect(() => {
    if (!chatAvailable || !db) {
      setChatRooms([]);
      setChatRoomsError(firebaseError);
      return undefined;
    }
    try {
      return listenToBuyerChatRooms(db, user.id, setChatRooms, (error) => setChatRoomsError(error.message));
    } catch (error) {
      setChatRoomsError(error.message);
      setChatRooms([]);
    }
  }, [user.id, chatAvailable, firebaseError]);
  const statusMutation = useMutation({
    mutationFn: ({ endpoint, id, status }) => api.patch(`/${endpoint}/${id}/status`, { status }),
    onSuccess: (_data, variables) => {
      const key = variables.endpoint === 'interests'
        ? queryKeys.interests.mine(user.id)
        : queryKeys.appointments.mine(user.id, 'buyer');
      const keys = variables.endpoint === 'interests'
        ? [key, queryKeys.interests.all, queryKeys.properties.all, queryKeys.admin.stats]
        : [key, queryKeys.appointments.all, queryKeys.admin.stats];
      return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });
  if (interestsPending || appointmentsPending) return <Spinner />;
  if ((interestsError && !interests) || (appointmentsError && !appts)) {
    return <div className="container"><Alert type="error">{interestsError?.message || appointmentsError?.message}</Alert></div>;
  }
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
      {(interestsError || appointmentsError) && <Alert type="error">{interestsError?.message || appointmentsError?.message}</Alert>}
      {statusMutation.error && <Alert type="error">{statusMutation.error.message}</Alert>}
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
                      <button className="btn small secondary" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ endpoint: 'interests', id: i.id, status: 'withdrawn' })}>Withdraw</button>
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
                      <button className="btn small danger" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ endpoint: 'appointments', id: a.id, status: 'cancelled' })}>Cancel</button>
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
          {!chatAvailable ? (
            <div className="alert info">{firebaseError || 'Chat is unavailable because Firebase is not configured.'}</div>
          ) : chatRoomsError ? (
            <div className="alert error">{chatRoomsError}</div>
          ) : null}
          {chatAvailable && chatRooms === null ? <Spinner /> : chatAvailable && chatRooms.length === 0 ? (
            <p className="muted">No conversations yet. <Link to="/browse">Browse properties</Link> to contact a seller.</p>
          ) : chatAvailable && (
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
          {chatAvailable && activeChatRoom && (
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
