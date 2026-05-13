import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import styles from './GroupChat.module.css';

export default function GroupChat({ groupId, isAdmin }) {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [unread, setUnread]       = useState(0);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const joinedRef = useRef(false);

  // Join room when socket connects
  useEffect(() => {
    if (!socket || !connected || !groupId || joinedRef.current) return;

    socket.emit('join_group', { groupId });
    joinedRef.current = true;

    socket.on('message_history', (msgs) => {
      setMessages(msgs);
    });

    socket.on('new_message', (msg) => {
      setMessages(prev => [...prev, msg]);
      // Increment unread if panel is closed and message is from someone else
      if (!open && msg.user_id !== user?.id) {
        setUnread(n => n + 1);
      }
    });

    return () => {
      socket.emit('leave_group', { groupId });
      socket.off('message_history');
      socket.off('new_message');
      joinedRef.current = false;
    };
  }, [socket, connected, groupId]);

  // Re-join if socket reconnects
  useEffect(() => {
    if (socket && connected && groupId && !joinedRef.current) {
      socket.emit('join_group', { groupId });
      joinedRef.current = true;
    }
  }, [connected]);

  // Scroll to bottom when panel opens or new messages arrive while open
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const handleOpen = () => {
    setOpen(true);
    setUnread(0);
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
      inputRef.current?.focus();
    }, 50);
  };

  const handleSend = useCallback(() => {
    if (!input.trim() || !socket) return;
    socket.emit('send_message', { groupId, message: input.trim() });
    setInput('');
    inputRef.current?.focus();
  }, [input, socket, groupId]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const grouped = messages.map((msg, i) => ({
    ...msg,
    isFirst: i === 0 || messages[i - 1].user_id !== msg.user_id || msg.is_system,
    isLast:  i === messages.length - 1 || messages[i + 1]?.user_id !== msg.user_id || messages[i + 1]?.is_system,
  }));

  return (
    <>
      {/* Floating trigger button */}
      <button className={styles.trigger} onClick={handleOpen} title="Open group chat">
        💬
        {unread > 0 && <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>

      {/* Chat panel */}
      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <span className={styles.headerTitle}>💬 Group Chat</span>
            <div className={styles.headerRight}>
              <span className={styles.status}>
                {connected ? '● Online' : '○ Connecting...'}
              </span>
              <button className={styles.closeBtn} onClick={() => setOpen(false)}>✕</button>
            </div>
          </div>

          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.empty}>
                <p>No messages yet.</p>
                <small>Be the first to say something!</small>
              </div>
            )}

            {grouped.map((msg) => {
              if (msg.is_system) {
                return (
                  <div key={msg.id} className={styles.systemMsg}>
                    <span>{msg.message}</span>
                  </div>
                );
              }

              const mine = msg.user_id === user?.id;
              return (
                <div key={msg.id} className={`${styles.msgRow} ${mine ? styles.mine : styles.theirs}`}>
                  {!mine && msg.isFirst && (
                    <div className={styles.avatar}>
                      {msg.profile_picture_url
                        ? <img src={msg.profile_picture_url} alt={msg.name} />
                        : <span>{msg.name?.[0]?.toUpperCase()}</span>
                      }
                    </div>
                  )}
                  {!mine && !msg.isFirst && <div className={styles.avatarSpacer} />}

                  <div className={styles.msgContent}>
                    {!mine && msg.isFirst && (
                      <span className={styles.senderName}>{msg.name}</span>
                    )}
                    <div className={`${styles.bubble} ${mine ? styles.bubbleMine : styles.bubbleTheirs}`}>
                      {msg.message}
                    </div>
                    {msg.isLast && (
                      <span className={styles.time}>{formatTime(msg.created_at)}</span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className={styles.inputRow}>
            <textarea
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              maxLength={1000}
              disabled={!connected}
            />
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!input.trim() || !connected}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
