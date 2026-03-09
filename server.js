const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { jwtVerify } = require('jose');
const { Pool } = require('pg');

const dev = process.env.NODE_ENV !== 'production';
const hostname = dev ? 'localhost' : '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Database pool for socket handlers
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: !dev ? { rejectUnauthorized: false } : undefined,
});

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');

// Track online users: Map<userId, Set<socketId>>
const onlineUsers = new Map();

// Track typing users: Map<conversationId, Map<userId, { name, timeout }>>
const typingUsers = new Map();

async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.userId;
  } catch {
    return null;
  }
}

async function getUserName(userId) {
  const result = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.name || 'Unknown';
}

async function getConversationMemberIds(conversationId) {
  const result = await pool.query(
    'SELECT user_id FROM conversation_members WHERE conversation_id = $1',
    [conversationId]
  );
  return result.rows.map((r) => r.user_id);
}

function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

function isUserOnline(userId) {
  const sockets = onlineUsers.get(userId);
  return sockets && sockets.size > 0;
}

function broadcastOnlineStatus(io, userId, isOnline) {
  io.emit('user_status', { userId, isOnline });
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const io = new Server(server, {
    cors: {
      origin: dev ? 'http://localhost:3000' : (process.env.NEXT_PUBLIC_APP_URL || 'https://finmate-yx36.onrender.com'),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: dev ? ['websocket', 'polling'] : ['polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    allowUpgrades: dev,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const userId = await verifyToken(token);
    if (!userId) {
      return next(new Error('Invalid token'));
    }

    socket.userId = userId;
    next();
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId} (socket: ${socket.id})`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Update database online status
    await pool.query('UPDATE users SET is_online = true WHERE id = $1', [userId]);
    broadcastOnlineStatus(io, userId, true);

    // Join user's conversation rooms
    const convResult = await pool.query(
      'SELECT conversation_id FROM conversation_members WHERE user_id = $1',
      [userId]
    );
    for (const row of convResult.rows) {
      socket.join(`conv:${row.conversation_id}`);
    }

    // ---- MESSAGE EVENTS ----

    socket.on('send_message', async (data) => {
      try {
        const { conversationId, content, messageType, replyToId, mediaUrl, mediaType, mediaMetadata } = data;

        // Verify membership
        const memberCheck = await pool.query(
          'SELECT id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, userId]
        );
        if (memberCheck.rows.length === 0) return;

        // Insert message
        const msgResult = await pool.query(
          `INSERT INTO messages (conversation_id, sender_id, content, message_type, reply_to_id, media_url, media_type, media_metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, conversation_id, sender_id, content, message_type, reply_to_id,
                     is_edited, is_deleted, created_at, media_url, media_type, media_metadata`,
          [conversationId, userId, content?.trim() || '', messageType || 'text', replyToId || null, mediaUrl || null, mediaType || null, mediaMetadata ? JSON.stringify(mediaMetadata) : null]
        );
        const message = msgResult.rows[0];

        // Update conversation timestamp
        await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

        // Update sender's last_read_at
        await pool.query(
          'UPDATE conversation_members SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, userId]
        );

        // Get sender info
        const senderResult = await pool.query(
          'SELECT name, avatar_url FROM users WHERE id = $1',
          [userId]
        );
        const sender = senderResult.rows[0];

        // Get reply info if replying
        let replyTo = null;
        if (replyToId) {
          const replyResult = await pool.query(
            `SELECT m.content, u.name as sender_name
             FROM messages m JOIN users u ON m.sender_id = u.id
             WHERE m.id = $1`,
            [replyToId]
          );
          if (replyResult.rows[0]) {
            replyTo = {
              id: replyToId,
              content: replyResult.rows[0].content,
              senderName: replyResult.rows[0].sender_name,
            };
          }
        }

        const fullMessage = {
          id: message.id,
          content: message.content,
          messageType: message.message_type,
          isEdited: message.is_edited,
          isDeleted: message.is_deleted,
          createdAt: message.created_at,
          sender: {
            id: userId,
            name: sender?.name,
            avatar_url: sender?.avatar_url,
          },
          replyTo,
          reactions: {},
          conversationId,
          mediaUrl: message.media_url,
          mediaType: message.media_type,
          mediaMetadata: message.media_metadata,
        };

        // Broadcast to conversation room
        io.to(`conv:${conversationId}`).emit('new_message', fullMessage);

        // Create notifications for non-muted offline members
        const otherMembers = await pool.query(
          `SELECT user_id FROM conversation_members
           WHERE conversation_id = $1 AND user_id != $2 AND is_muted = false`,
          [conversationId, userId]
        );

        for (const member of otherMembers.rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, data)
             VALUES ($1, 'new_message', $2, $3, $4)`,
            [
              member.user_id,
              `New message from ${sender?.name}`,
              (content?.trim() || '').substring(0, 100),
              JSON.stringify({ conversationId, messageId: message.id }),
            ]
          );

          // Send real-time notification
          const memberSockets = onlineUsers.get(member.user_id);
          if (memberSockets) {
            for (const socketId of memberSockets) {
              io.to(socketId).emit('new_notification', {
                type: 'new_message',
                title: `New message from ${sender?.name}`,
                message: (content?.trim() || '').substring(0, 100),
                data: { conversationId, messageId: message.id },
              });
            }
          }
        }
      } catch (err) {
        console.error('send_message error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('edit_message', async (data) => {
      try {
        const { messageId, content } = data;

        // Verify ownership and 15-min window
        const msgResult = await pool.query(
          `SELECT id, conversation_id, sender_id, created_at FROM messages
           WHERE id = $1 AND sender_id = $2 AND is_deleted = false`,
          [messageId, userId]
        );
        if (msgResult.rows.length === 0) return;

        const msg = msgResult.rows[0];
        const minutesAgo = (Date.now() - new Date(msg.created_at).getTime()) / 60000;
        if (minutesAgo > 15) {
          socket.emit('error', { message: 'Cannot edit messages older than 15 minutes' });
          return;
        }

        await pool.query(
          'UPDATE messages SET content = $1, is_edited = true, updated_at = NOW() WHERE id = $2',
          [content.trim(), messageId]
        );

        io.to(`conv:${msg.conversation_id}`).emit('message_edited', {
          messageId,
          content: content.trim(),
          conversationId: msg.conversation_id,
        });
      } catch (err) {
        console.error('edit_message error:', err);
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    socket.on('delete_message', async (data) => {
      try {
        const { messageId } = data;

        const msgResult = await pool.query(
          `SELECT id, conversation_id FROM messages
           WHERE id = $1 AND sender_id = $2 AND is_deleted = false`,
          [messageId, userId]
        );
        if (msgResult.rows.length === 0) return;

        const msg = msgResult.rows[0];

        await pool.query(
          `UPDATE messages SET is_deleted = true, content = 'This message was deleted', updated_at = NOW()
           WHERE id = $1`,
          [messageId]
        );
        await pool.query('DELETE FROM message_reactions WHERE message_id = $1', [messageId]);

        io.to(`conv:${msg.conversation_id}`).emit('message_deleted', {
          messageId,
          conversationId: msg.conversation_id,
        });
      } catch (err) {
        console.error('delete_message error:', err);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // ---- TYPING INDICATORS ----

    socket.on('typing_start', async (data) => {
      const { conversationId } = data;
      const userName = await getUserName(userId);

      if (!typingUsers.has(conversationId)) {
        typingUsers.set(conversationId, new Map());
      }

      const convTyping = typingUsers.get(conversationId);

      // Clear existing timeout
      if (convTyping.has(userId)) {
        clearTimeout(convTyping.get(userId).timeout);
      }

      // Auto-stop after 5 seconds
      const timeout = setTimeout(() => {
        convTyping.delete(userId);
        socket.to(`conv:${conversationId}`).emit('typing_update', {
          conversationId,
          typingUsers: Array.from(convTyping.entries()).map(([id, v]) => ({
            userId: id,
            name: v.name,
          })),
        });
      }, 5000);

      convTyping.set(userId, { name: userName, timeout });

      socket.to(`conv:${conversationId}`).emit('typing_update', {
        conversationId,
        typingUsers: Array.from(convTyping.entries()).map(([id, v]) => ({
          userId: id,
          name: v.name,
        })),
      });
    });

    socket.on('typing_stop', (data) => {
      const { conversationId } = data;
      const convTyping = typingUsers.get(conversationId);
      if (convTyping) {
        if (convTyping.has(userId)) {
          clearTimeout(convTyping.get(userId).timeout);
        }
        convTyping.delete(userId);

        socket.to(`conv:${conversationId}`).emit('typing_update', {
          conversationId,
          typingUsers: Array.from(convTyping.entries()).map(([id, v]) => ({
            userId: id,
            name: v.name,
          })),
        });
      }
    });

    // ---- READ RECEIPTS ----

    socket.on('messages_read', async (data) => {
      try {
        const { conversationId, messageIds } = data;

        // Update last_read_at
        await pool.query(
          'UPDATE conversation_members SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, userId]
        );

        // Insert read receipts
        for (const messageId of messageIds) {
          await pool.query(
            `INSERT INTO message_reads (message_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (message_id, user_id) DO NOTHING`,
            [messageId, userId]
          );
        }

        socket.to(`conv:${conversationId}`).emit('messages_read', {
          conversationId,
          userId,
          messageIds,
        });
      } catch (err) {
        console.error('messages_read error:', err);
      }
    });

    // ---- REACTIONS ----

    socket.on('toggle_reaction', async (data) => {
      try {
        const { messageId, emoji } = data;

        // Verify message exists and user has access
        const msgResult = await pool.query(
          `SELECT m.conversation_id FROM messages m
           JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
           WHERE m.id = $1 AND cm.user_id = $2`,
          [messageId, userId]
        );
        if (msgResult.rows.length === 0) return;

        const conversationId = msgResult.rows[0].conversation_id;

        // Toggle reaction
        const existing = await pool.query(
          'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
          [messageId, userId, emoji]
        );

        const userName = await getUserName(userId);

        if (existing.rows.length > 0) {
          await pool.query(
            'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
            [messageId, userId, emoji]
          );
        } else {
          await pool.query(
            'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
            [messageId, userId, emoji]
          );
        }

        // Get updated reactions for this message
        const reactionsResult = await pool.query(
          `SELECT mr.emoji, u.name FROM message_reactions mr
           JOIN users u ON mr.user_id = u.id
           WHERE mr.message_id = $1`,
          [messageId]
        );

        const reactions = {};
        for (const r of reactionsResult.rows) {
          if (!reactions[r.emoji]) reactions[r.emoji] = [];
          reactions[r.emoji].push(r.name);
        }

        io.to(`conv:${conversationId}`).emit('reaction_updated', {
          messageId,
          conversationId,
          reactions,
          action: existing.rows.length > 0 ? 'removed' : 'added',
          emoji,
          userName,
        });
      } catch (err) {
        console.error('toggle_reaction error:', err);
      }
    });

    // ---- ONLINE STATUS ----

    socket.on('get_online_friends', async (callback) => {
      try {
        const friendsResult = await pool.query(
          `SELECT CASE
             WHEN f.requester_id = $1 THEN f.addressee_id
             ELSE f.requester_id
           END as friend_id
           FROM friendships f
           WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'`,
          [userId]
        );

        const onlineFriends = friendsResult.rows
          .map((r) => r.friend_id)
          .filter((id) => isUserOnline(id));

        if (typeof callback === 'function') {
          callback({ onlineFriends });
        }
      } catch (err) {
        console.error('get_online_friends error:', err);
        if (typeof callback === 'function') {
          callback({ onlineFriends: [] });
        }
      }
    });

    // ---- JOIN/LEAVE CONVERSATION ROOMS ----

    socket.on('join_conversation', (data) => {
      const { conversationId } = data;
      socket.join(`conv:${conversationId}`);
    });

    socket.on('leave_conversation', (data) => {
      const { conversationId } = data;
      socket.leave(`conv:${conversationId}`);
    });

    // ---- CALL SIGNALING ----

    socket.on('call_initiate', async (data) => {
      try {
        const { calleeId, callType, conversationId } = data;

        // Create call log entry
        const callResult = await pool.query(
          `INSERT INTO call_logs (conversation_id, caller_id, callee_id, call_type, status)
           VALUES ($1, $2, $3, $4, 'ringing')
           RETURNING id`,
          [conversationId, userId, calleeId, callType]
        );
        const callId = callResult.rows[0].id;

        // Get caller info
        const callerInfo = await pool.query(
          'SELECT name, avatar_url FROM users WHERE id = $1',
          [userId]
        );
        const caller = callerInfo.rows[0];

        // Send incoming call to callee
        const calleeSockets = onlineUsers.get(calleeId);
        if (calleeSockets) {
          for (const socketId of calleeSockets) {
            io.to(socketId).emit('incoming_call', {
              callId,
              caller: { id: userId, name: caller?.name, avatar_url: caller?.avatar_url },
              callType,
              conversationId,
            });
          }
        } else {
          // Callee is offline, mark as missed
          await pool.query(
            `UPDATE call_logs SET status = 'missed' WHERE id = $1`,
            [callId]
          );
          socket.emit('call_missed', { callId });
        }

        // Send callId back to caller
        socket.emit('call_initiated', { callId });

        // Set 30-second timeout for unanswered calls
        setTimeout(async () => {
          const check = await pool.query(
            'SELECT status FROM call_logs WHERE id = $1',
            [callId]
          );
          if (check.rows[0]?.status === 'ringing') {
            await pool.query(
              `UPDATE call_logs SET status = 'missed' WHERE id = $1`,
              [callId]
            );
            // Notify both parties
            socket.emit('call_missed', { callId });
            if (calleeSockets) {
              for (const socketId of calleeSockets) {
                io.to(socketId).emit('call_missed', { callId });
              }
            }
          }
        }, 30000);
      } catch (err) {
        console.error('call_initiate error:', err);
        socket.emit('error', { message: 'Failed to initiate call' });
      }
    });

    socket.on('call_accept', async (data) => {
      try {
        const { callId } = data;

        const result = await pool.query(
          `UPDATE call_logs SET status = 'active', started_at = NOW()
           WHERE id = $1 AND callee_id = $2
           RETURNING caller_id`,
          [callId, userId]
        );

        if (result.rows.length === 0) return;

        const callerId = result.rows[0].caller_id;
        const callerSockets = onlineUsers.get(callerId);
        if (callerSockets) {
          for (const socketId of callerSockets) {
            io.to(socketId).emit('call_accepted', { callId });
          }
        }
      } catch (err) {
        console.error('call_accept error:', err);
      }
    });

    socket.on('call_decline', async (data) => {
      try {
        const { callId } = data;

        const result = await pool.query(
          `UPDATE call_logs SET status = 'declined'
           WHERE id = $1 AND callee_id = $2
           RETURNING caller_id`,
          [callId, userId]
        );

        if (result.rows.length === 0) return;

        const callerId = result.rows[0].caller_id;
        const callerSockets = onlineUsers.get(callerId);
        if (callerSockets) {
          for (const socketId of callerSockets) {
            io.to(socketId).emit('call_declined', { callId });
          }
        }
      } catch (err) {
        console.error('call_decline error:', err);
      }
    });

    socket.on('call_end', async (data) => {
      try {
        const { callId } = data;

        const result = await pool.query(
          `UPDATE call_logs SET status = 'ended', ended_at = NOW(),
           duration = EXTRACT(EPOCH FROM (NOW() - COALESCE(started_at, NOW())))::integer
           WHERE id = $1 AND (caller_id = $2 OR callee_id = $2)
           RETURNING caller_id, callee_id, duration`,
          [callId, userId]
        );

        if (result.rows.length === 0) return;

        const { caller_id, callee_id, duration } = result.rows[0];
        const otherUserId = caller_id === userId ? callee_id : caller_id;

        const otherSockets = onlineUsers.get(otherUserId);
        if (otherSockets) {
          for (const socketId of otherSockets) {
            io.to(socketId).emit('call_ended', { callId, duration });
          }
        }
      } catch (err) {
        console.error('call_end error:', err);
      }
    });

    // WebRTC signaling relay
    socket.on('webrtc_offer', (data) => {
      const { targetUserId, offer, callId } = data;
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        for (const socketId of targetSockets) {
          io.to(socketId).emit('webrtc_offer', { callId, offer, fromUserId: userId });
        }
      }
    });

    socket.on('webrtc_answer', (data) => {
      const { targetUserId, answer, callId } = data;
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        for (const socketId of targetSockets) {
          io.to(socketId).emit('webrtc_answer', { callId, answer, fromUserId: userId });
        }
      }
    });

    socket.on('webrtc_ice_candidate', (data) => {
      const { targetUserId, candidate, callId } = data;
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        for (const socketId of targetSockets) {
          io.to(socketId).emit('webrtc_ice_candidate', { callId, candidate, fromUserId: userId });
        }
      }
    });

    socket.on('call_toggle_audio', (data) => {
      const { callId, isMuted, targetUserId } = data;
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        for (const socketId of targetSockets) {
          io.to(socketId).emit('remote_audio_toggle', { callId, isMuted });
        }
      }
    });

    socket.on('call_toggle_video', (data) => {
      const { callId, isVideoOff, targetUserId } = data;
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        for (const socketId of targetSockets) {
          io.to(socketId).emit('remote_video_toggle', { callId, isVideoOff });
        }
      }
    });

    // ---- DISCONNECT ----

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId} (socket: ${socket.id})`);

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          await pool.query(
            'UPDATE users SET is_online = false, last_seen = NOW() WHERE id = $1',
            [userId]
          );
          broadcastOnlineStatus(io, userId, false);
        }
      }

      // Clean up typing indicators
      for (const [convId, convTyping] of typingUsers.entries()) {
        if (convTyping.has(userId)) {
          clearTimeout(convTyping.get(userId).timeout);
          convTyping.delete(userId);
          io.to(`conv:${convId}`).emit('typing_update', {
            conversationId: convId,
            typingUsers: Array.from(convTyping.entries()).map(([id, v]) => ({
              userId: id,
              name: v.name,
            })),
          });
        }
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
