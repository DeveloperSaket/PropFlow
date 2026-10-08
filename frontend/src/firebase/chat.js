import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

function getRoomId(buyerId, sellerId, productId) {
  return `${String(buyerId)}_${String(sellerId)}_${String(productId)}`;
}

export async function getOrCreateChatRoom(db, { buyerId, sellerId, productId }) {
  if (!db) throw new Error('Firebase Firestore is not configured.');
  if (!buyerId || !sellerId || !productId) throw new Error('Buyer, seller, and product IDs are required.');

  const roomId = getRoomId(buyerId, sellerId, productId);
  const roomRef = doc(db, 'chat_rooms', roomId);

  try {
    const snapshot = await getDoc(roomRef);
    if (snapshot.exists()) return { id: snapshot.id, ...snapshot.data() };

    const room = {
      buyer_id: String(buyerId),
      seller_id: String(sellerId),
      product_id: String(productId),
      last_message: '',
      last_updated: serverTimestamp(),
      buyer_read_at: serverTimestamp(),
      seller_read_at: serverTimestamp(),
    };
    await setDoc(roomRef, room);
    return { id: roomId, ...room };
  } catch (error) {
    throw new Error(`Unable to initialize chat room: ${error.message}`);
  }
}

export async function markChatRoomRead(db, roomId, participantId, room) {
  if (!db) throw new Error('Firebase Firestore is not configured.');
  const normalizedParticipantId = String(participantId);
  const readField = room?.buyer_id === normalizedParticipantId
    ? 'buyer_read_at'
    : room?.seller_id === normalizedParticipantId
      ? 'seller_read_at'
      : null;
  if (!roomId || !readField) throw new Error('The current user is not a participant in this chat.');

  try {
    await updateDoc(doc(db, 'chat_rooms', roomId), { [readField]: serverTimestamp() });
  } catch (error) {
    throw new Error(`Unable to update chat read status: ${error.message}`);
  }
}

export function getUnreadChatCount(rooms, participantId) {
  const normalizedParticipantId = String(participantId);
  return rooms.filter((room) => {
    if (!room.last_message) return false;
    const readAt = room.buyer_id === normalizedParticipantId
      ? room.buyer_read_at
      : room.seller_id === normalizedParticipantId
        ? room.seller_read_at
        : null;
    return !readAt || (room.last_updated?.toMillis?.() ?? 0) > (readAt.toMillis?.() ?? 0);
  }).length;
}

export async function sendMessage(db, roomId, { senderId, text }) {
  if (!db) throw new Error('Firebase Firestore is not configured.');
  const message = text.trim();
  if (!roomId || !senderId || !message) throw new Error('Room, sender, and message text are required.');
  const normalizedSenderId = String(senderId);

  try {
    const roomRef = doc(db, 'chat_rooms', roomId);
    const messageRef = doc(collection(roomRef, 'messages'));
    const batch = writeBatch(db);
    batch.set(messageRef, {
      sender_id: normalizedSenderId,
      text: message,
      timestamp: serverTimestamp(),
    });
    batch.update(roomRef, {
      last_message: message,
      last_updated: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    throw new Error(`Unable to send message: ${error.message}`);
  }
}

export function listenToMessages(db, roomId, onMessages, onError) {
  if (!db) throw new Error('Firebase Firestore is not configured.');
  if (!roomId) throw new Error('A chat room ID is required.');

  const messagesQuery = query(
    collection(db, 'chat_rooms', roomId, 'messages'),
    orderBy('timestamp', 'asc'),
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      onMessages(snapshot.docs.map((message) => ({ id: message.id, ...message.data() })));
    },
    (error) => {
      onError?.(new Error(`Unable to listen for messages: ${error.message}`));
    },
  );
}

export function listenToSellerChatRooms(db, sellerId, onRooms, onError) {
  if (!db) throw new Error('Firebase Firestore is not configured.');
  if (!sellerId) throw new Error('A seller ID is required.');

  const roomsQuery = query(
    collection(db, 'chat_rooms'),
    where('seller_id', '==', String(sellerId)),
  );

  return onSnapshot(
    roomsQuery,
    (snapshot) => {
      const rooms = snapshot.docs.map((room) => ({ id: room.id, ...room.data() }));
      rooms.sort((left, right) => (right.last_updated?.toMillis?.() ?? 0) - (left.last_updated?.toMillis?.() ?? 0));
      onRooms(rooms);
    },
    (error) => {
      onError?.(new Error(`Unable to listen for chats: ${error.message}`));
    },
  );
}
