import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

function getRoomId(buyerId, sellerId, productId) {
  return `${buyerId}_${sellerId}_${productId}`;
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
      buyer_id: buyerId,
      seller_id: sellerId,
      product_id: productId,
      last_message: '',
      last_updated: serverTimestamp(),
    };
    await setDoc(roomRef, room);
    return { id: roomId, ...room };
  } catch (error) {
    throw new Error(`Unable to initialize chat room: ${error.message}`);
  }
}

export async function sendMessage(db, roomId, { senderId, text }) {
  if (!db) throw new Error('Firebase Firestore is not configured.');
  const message = text.trim();
  if (!roomId || !senderId || !message) throw new Error('Room, sender, and message text are required.');

  try {
    const roomRef = doc(db, 'chat_rooms', roomId);
    await addDoc(collection(roomRef, 'messages'), {
      sender_id: senderId,
      text: message,
      timestamp: serverTimestamp(),
    });
    await updateDoc(roomRef, {
      last_message: message,
      last_updated: serverTimestamp(),
    });
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
