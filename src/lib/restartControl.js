// Shared state between the /restart command's countdown loop and the
// cancel-button click handler, since a button click and the running
// countdown are handled by separate interaction events.
let active = null; // { requesterId, cancelled, cancelledById }

export function startRestart(requesterId) {
  active = { requesterId, cancelled: false, cancelledById: null };
}

export function cancelRestart(byUserId) {
  if (active) {
    active.cancelled = true;
    active.cancelledById = byUserId;
  }
}

export function isCancelled() {
  return active?.cancelled ?? false;
}

export function getRequesterId() {
  return active?.requesterId ?? null;
}

export function getCancelledById() {
  return active?.cancelledById ?? null;
}

export function clearRestart() {
  active = null;
}
