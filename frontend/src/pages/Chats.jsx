import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { Spinner } from '../components/ui.jsx';
import Chat from '../components/Chat/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { db } from '../firebase/index.js';
import {
  getUnreadChatCount,
  listenToBuyerChatRooms,
  listenToSellerChatRooms,
} from '../firebase/chat.js';

export default function Chats() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'seller' ? 'seller' : 'buyer';
  const [buyerRooms, setBuyerRooms] = useState(null);
  const [sellerRooms, setSellerRooms] = useState(null);
  const [buyerInterests, setBuyerInterests] = useState([]);
  const [sellerLeads, setSellerLeads] = useState([]);
  const [propertyData, setPropertyData] = useState({});
  const [activeChatKey, setActiveChatKey] = useState(null);
  const [buyerError, setBuyerError] = useState('');
  const [sellerError, setSellerError] = useState('');

  useEffect(() => {
    let unsubscribeBuyer;
    let unsubscribeSeller;
    try {
      unsubscribeBuyer = listenToBuyerChatRooms(
        db,
        user.id,
        (rooms) => {
          setBuyerRooms(rooms);
          setBuyerError('');
        },
        (error) => {
          setBuyerError(error.message);
          setBuyerRooms([]);
        },
      );
      unsubscribeSeller = listenToSellerChatRooms(
        db,
        user.id,
        (rooms) => {
          setSellerRooms(rooms);
          setSellerError('');
        },
        (error) => {
          setSellerError(error.message);
          setSellerRooms([]);
        },
      );
    } catch (error) {
      setBuyerError(error.message);
      setSellerError(error.message);
      setBuyerRooms([]);
      setSellerRooms([]);
    }
    return () => {
      unsubscribeBuyer?.();
      unsubscribeSeller?.();
    };
  }, [user.id]);

  useEffect(() => {
    api.get('/interests/mine')
      .then((response) => setBuyerInterests(response.data))
      .catch(() => setBuyerInterests([]));
    api.get('/interests/received')
      .then((response) => setSellerLeads(response.data))
      .catch(() => setSellerLeads([]));
  }, [user.id]);

  const propertyIds = [...new Set([
    ...(buyerRooms || []).map((room) => String(room.product_id)),
    ...(sellerRooms || []).map((room) => String(room.product_id)),
  ])].sort().join(',');

  useEffect(() => {
    if (!propertyIds) {
      setPropertyData({});
      return undefined;
    }
    let active = true;
    Promise.all(propertyIds.split(',').map(async (propertyId) => {
      try {
        const response = await api.get(`/properties/${propertyId}`);
        return [propertyId, response.data];
      } catch {
        return [propertyId, null];
      }
    })).then((entries) => {
      if (active) setPropertyData(Object.fromEntries(entries));
    });
    return () => { active = false; };
  }, [propertyIds]);

  const buyerItems = (buyerRooms || []).map((room) => ({
    key: `buyer:${room.id}`,
    room,
    buyerId: room.buyer_id,
    sellerId: room.seller_id,
    productId: room.product_id,
    personName: propertyData[room.product_id]?.seller_name || `Seller #${room.seller_id}`,
    propertyName: propertyData[room.product_id]?.title || `Property #${room.product_id}`,
  }));
  const sellerItems = [
    ...sellerLeads.map((lead) => {
      const room = (sellerRooms || []).find((candidate) => (
        String(candidate.buyer_id) === String(lead.buyer_id)
        && String(candidate.product_id) === String(lead.property_id)
      ));
      return {
        key: `seller:${lead.buyer_id}_${user.id}_${lead.property_id}`,
        room,
        buyerId: String(lead.buyer_id),
        sellerId: String(user.id),
        productId: String(lead.property_id),
        personName: lead.buyer_name,
        propertyName: lead.title,
      };
    }),
    ...(sellerRooms || [])
      .filter((room) => !sellerLeads.some((lead) => (
        String(lead.buyer_id) === room.buyer_id
        && String(lead.property_id) === room.product_id
      )))
      .map((room) => ({
        key: `seller:${room.buyer_id}_${room.seller_id}_${room.product_id}`,
        room,
        buyerId: room.buyer_id,
        sellerId: room.seller_id,
        productId: room.product_id,
        personName: `Buyer #${room.buyer_id}`,
        propertyName: propertyData[room.product_id]?.title || `Property #${room.product_id}`,
      })),
  ];
  const items = view === 'buyer' ? buyerItems : sellerItems;
  const roomsLoading = view === 'buyer' ? buyerRooms === null : sellerRooms === null;
  const error = view === 'buyer' ? buyerError : sellerError;
  const rooms = view === 'buyer' ? buyerRooms || [] : sellerRooms || [];
  const unreadCount = getUnreadChatCount(rooms, user.id);
  const activeChat = items.find((item) => item.key === activeChatKey);

  const changeView = (nextView) => {
    setActiveChatKey(null);
    setSearchParams(nextView === 'buyer' ? {} : { view: nextView }, { replace: true });
  };

  return (
    <div className="container">
      <h1 className="page-title">Chats</h1>
      <p className="subtle">Conversations stay tied to the property and the people involved.</p>
      <div className="tabs" role="tablist" aria-label="Chat role">
        <button type="button" role="tab" aria-selected={view === 'buyer'} className={`tab ${view === 'buyer' ? 'active' : ''}`} onClick={() => changeView('buyer')}>
          Buyer ({buyerRooms?.length ?? 0})
        </button>
        <button type="button" role="tab" aria-selected={view === 'seller'} className={`tab ${view === 'seller' ? 'active' : ''}`} onClick={() => changeView('seller')}>
          Seller ({sellerItems.length}){view === 'seller' && unreadCount ? ` · ${unreadCount} new` : ''}
        </button>
      </div>
      {error && <div className="alert error">{error}</div>}
      {roomsLoading ? <Spinner /> : items.length === 0 ? (
        <p className="muted">
          {view === 'buyer'
            ? <>No buyer conversations yet. <Link to="/browse">Browse properties</Link> to contact a seller.</>
            : 'No seller conversations yet. Conversations appear here when buyers contact you about a listing.'}
        </p>
      ) : (
        <div className="table-wrap card p-0">
          <table>
            <thead><tr><th>Property</th><th>{view === 'buyer' ? 'Seller' : 'Buyer'}</th><th>Last message</th><th>Updated</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map((item) => {
                const room = item.room;
                return (
                  <tr key={item.key}>
                    <td>{item.propertyName}</td>
                    <td>{item.personName}</td>
                    <td className="muted">{room?.last_message || 'No messages yet'}</td>
                    <td>{room?.last_updated?.toDate?.().toLocaleString() || 'Not started'}</td>
                    <td>{room && getUnreadChatCount([room], user.id) > 0 && <span className="badge pending">New</span>}</td>
                    <td>
                      <button type="button" className="btn small" onClick={() => setActiveChatKey(activeChatKey === item.key ? null : item.key)}>
                        {activeChatKey === item.key ? 'Close' : room ? 'Open chat' : 'Start chat'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {activeChat && (
        <div className="mt-20">
          <Chat
            db={db}
            currentUserId={user.id}
            buyerId={activeChat.buyerId}
            sellerId={activeChat.sellerId}
            productId={activeChat.productId}
            otherUserLabel={activeChat.personName}
          />
        </div>
      )}
    </div>
  );
}