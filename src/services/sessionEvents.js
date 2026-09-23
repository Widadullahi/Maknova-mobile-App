const listeners = new Set();

export function onSessionExpired(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function emitSessionExpired() {
  listeners.forEach((callback) => callback());
}
