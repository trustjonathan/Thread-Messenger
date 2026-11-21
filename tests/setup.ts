import WebSocket from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  // @ts-expect-error ws is compatible with global WebSocket in test environment
  globalThis.WebSocket = WebSocket;
}
