export default function ChatConversationCard({ item, view, unread, active, onToggle }) {
  const actionLabel = active ? 'Close chat' : item.room ? 'Open chat' : 'Start chat';
  const updatedAt = item.room?.last_updated?.toDate?.().toLocaleString() || 'Not started';

  return (
    <article className={`chat-conversation-card ${active ? 'active' : ''}`}>
      <div className="chat-conversation-heading">
        <div className="chat-conversation-titles">
          <h2>{item.propertyName}</h2>
          <p>{view === 'buyer' ? 'Seller' : 'Buyer'}: {item.personName}</p>
        </div>
        {unread && <span className="badge pending">New</span>}
      </div>
      <p className="chat-conversation-message">{item.room?.last_message || 'No messages yet'}</p>
      <div className="chat-conversation-footer">
        <time>{updatedAt}</time>
        <button
          type="button"
          className="btn small"
          aria-label={`${actionLabel} with ${item.personName}`}
          aria-expanded={active}
          onClick={onToggle}
        >
          {actionLabel}
        </button>
      </div>
    </article>
  );
}