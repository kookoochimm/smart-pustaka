const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5003/api";
const BASE_URL = `${API_URL}/website/notifications`;

function authHeaders() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Your session has expired. Please log in again.");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export const notificationService = {
  async getPublicKey() {
    const response = await fetch(`${BASE_URL}/vapid-public-key`);
    const data = await response.json();
    if (!response.ok || !data.success || !data.publicKey) {
      throw new Error(data.message || "Unable to get notification public key.");
    }
    return data.publicKey;
  },

  async subscribe(subscription) {
    const response = await fetch(`${BASE_URL}/subscribe`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ subscription }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "Unable to save push subscription.");
    return data;
  },

  async getAll() {
    const response = await fetch(`${BASE_URL}`, { headers: authHeaders() });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "Unable to load notifications.");
    return data;
  },

  async markRead(id) {
    const response = await fetch(`${BASE_URL}/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || "Unable to update notification.");
    return data;
  },
};
