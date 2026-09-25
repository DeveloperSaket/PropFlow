import { useEffect, useRef, useState } from 'react';
import { getOrCreateChatRoom, listenToMessages, sendMessage } from '../../firebase/chat.js';

function formatTimestamp(timestamp) {
	if (!timestamp?.toDate) return 'Sending...';
	return timestamp.toDate().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

export default function Chat({ db, currentUserId, buyerId, sellerId, productId, otherUserLabel = 'Seller' }) {
	const [room, setRoom] = useState(null);
	const [messages, setMessages] = useState([]);
	const [text, setText] = useState('');
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState('');
	const messagesEndRef = useRef(null);

	useEffect(() => {
		let unsubscribe;
		let active = true;

		async function initializeChat() {
			setLoading(true);
			setError('');
			try {
				const chatRoom = await getOrCreateChatRoom(db, { buyerId, sellerId, productId });
				if (!active) return;
				setRoom(chatRoom);
				unsubscribe = listenToMessages(db, chatRoom.id, setMessages, setError);
			} catch (chatError) {
				if (active) setError(chatError.message);
			} finally {
				if (active) setLoading(false);
			}
		}

		initializeChat();
		return () => {
			active = false;
			unsubscribe?.();
		};
	}, [db, buyerId, sellerId, productId]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	async function handleSubmit(event) {
		event.preventDefault();
		if (!text.trim() || !room || sending) return;

		setSending(true);
		setError('');
		try {
			await sendMessage(db, room.id, { senderId: currentUserId, text });
			setText('');
		} catch (sendError) {
			setError(sendError.message);
		} finally {
			setSending(false);
		}
	}

	return (
		<section className="chat-panel" aria-label={`Chat with ${otherUserLabel}`}>
			<div className="chat-header">
				<div>
					<h2>Chat with {otherUserLabel}</h2>
					<p>Ask questions about this property</p>
				</div>
				<span className="chat-status">Live</span>
			</div>

			<div className="chat-messages" aria-live="polite">
				{loading && <p className="chat-placeholder">Opening secure chat...</p>}
				{!loading && !messages.length && !error && (
					<p className="chat-placeholder">No messages yet. Start the conversation.</p>
				)}
				{messages.map((message) => {
					const ownMessage = message.sender_id === currentUserId;
					return (
						<div key={message.id} className={`chat-message-row ${ownMessage ? 'own' : 'other'}`}>
							<div className={`chat-message ${ownMessage ? 'own' : 'other'}`}>
								<p>{message.text}</p>
								<time>{formatTimestamp(message.timestamp)}</time>
							</div>
						</div>
					);
				})}
				<div ref={messagesEndRef} />
			</div>

			{error && <p className="chat-error" role="alert">{error}</p>}
			<form className="chat-form" onSubmit={handleSubmit}>
				<input
					value={text}
					onChange={(event) => setText(event.target.value)}
					placeholder="Write a message..."
					aria-label="Message"
					disabled={loading || sending || !room}
					maxLength={2000}
				/>
				<button className="btn" type="submit" disabled={loading || sending || !text.trim() || !room}>
					{sending ? 'Sending...' : 'Send'}
				</button>
			</form>
		</section>
	);
}
 