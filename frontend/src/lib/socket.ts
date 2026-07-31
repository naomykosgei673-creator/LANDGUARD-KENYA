'use client';

import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './api';

// The Socket.IO server runs on the API origin (without the trailing /api path).
const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api').replace(/\/api\/?$/, '');

// Custom DOM events the socket fans out to the whole app. `useAutoRefresh` listens
// for `lg:refresh` and re-fetches instantly, so any server-side change that pushes
// a notification makes every open page update live — no polling wait, no manual refresh.
export const REFRESH_EVENT = 'lg:refresh';
export const NOTIFICATION_EVENT = 'lg:notification';

let socket: Socket | null = null;

function emitRefresh(source: string, detail?: unknown) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REFRESH_EVENT, { detail: { source, detail } }));
}

// Opens (or reuses) the realtime connection for the signed-in user. Safe to call
// repeatedly. The auth token is provided per (re)connect so it's always current
// even after a silent access-token refresh.
export function connectSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  if (!tokenStore.access) return null;
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: (cb) => cb({ token: tokenStore.access ?? '' }),
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    timeout: 8000,
  });

  // A new notification for this user → bump badges + refresh the current view.
  socket.on('notification', (n) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: n }));
    emitRefresh('notification', n);
  });

  // A new chat message → refresh threads / conversation views.
  socket.on('message:new', (m) => emitRefresh('message', m));

  // On (re)connect, pull fresh data in case we missed events while disconnected.
  socket.on('connect', () => emitRefresh('connect'));

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
