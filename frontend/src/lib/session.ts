export const SESSION_CHANGED = "session-changed";
export const sessionToken = () => localStorage.getItem("authToken");

export function clearSession() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("currentUser");
  window.dispatchEvent(new Event(SESSION_CHANGED));
}

// A late response from a previous login must not invalidate a newer session.
export function handleUnauthorized(status: number, token: string | null) {
  if (status === 401 && token && sessionToken() === token) clearSession();
}

export function subscribeSession(listener: () => void) {
  window.addEventListener(SESSION_CHANGED, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(SESSION_CHANGED, listener);
    window.removeEventListener("storage", listener);
  };
}

export function loginDestination(value: unknown): string {
  // Only local protected routes are valid return destinations, never external URLs.
  return typeof value === "string" && /^\/(dashboard|assets|allocations|users|profile|licenses|maintainence|employees|qr-codes)(\/|\?|$)/.test(value)
    ? value : "/dashboard";
}
