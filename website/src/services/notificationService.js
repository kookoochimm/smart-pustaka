const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5003/api"
).replace(/\/+$/, "");

const BASE_URL = `${API_URL}/website/notifications`;

// Get login token
function authHeaders() {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Your session has expired. Please log in again.");
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Handle API response safely
async function handleResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const responseText = await response.text();

  let data;

  if (contentType.includes("application/json")) {
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error("Invalid JSON response from server.");
    }
  } else {
    throw new Error(
      `API returned HTML or an invalid response (${response.status}). ` +
      `Check backend route: ${response.url}`
    );
  }

  if (!response.ok || data.success === false) {
    throw new Error(
      data.message || `Request failed with status ${response.status}.`
    );
  }

  return data;
}

// Convert VAPID public key
export function urlBase64ToUint8Array(base64String) {
  if (!base64String) {
    throw new Error("VAPID public key is empty.");
  }

  const normalized = base64String
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padding = "=".repeat(
    (4 - (normalized.length % 4)) % 4
  );

  const raw = window.atob(normalized + padding);

  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }

  if (output.length !== 65 || output[0] !== 4) {
    throw new Error(
      `Invalid VAPID key. Length: ${output.length}, first byte: ${output[0]}`
    );
  }

  return output;
}

// Notification API service
export const notificationService = {

  // 1. Get VAPID public key
  async getPublicKey() {
    const url = `${BASE_URL}/vapid-public-key`;

    console.log("Getting VAPID public key:", url);

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    const data = await handleResponse(response);

    if (!data.publicKey) {
      throw new Error("VAPID public key is missing.");
    }

    return data.publicKey;
  },

  // 2. Save push subscription
  async subscribe(subscription) {
    if (!subscription || !subscription.endpoint) {
      throw new Error("Invalid push subscription.");
    }

    const response = await fetch(`${BASE_URL}/subscribe`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        subscription:
          typeof subscription.toJSON === "function"
            ? subscription.toJSON()
            : subscription,
      }),
    });

    return await handleResponse(response);
  },

  // 3. Get all notifications
  async getAll() {
    const response = await fetch(BASE_URL, {
      method: "GET",
      headers: authHeaders(),
      cache: "no-store",
    });

    return await handleResponse(response);
  },

  // 4. Mark notification as read
  async markRead(id) {
    if (!id) {
      throw new Error("Notification ID is required.");
    }

    const response = await fetch(
      `${BASE_URL}/${encodeURIComponent(id)}/read`,
      {
        method: "PATCH",
        headers: authHeaders(),
      }
    );

    return await handleResponse(response);
  },

  // 5. Unsubscribe from push notifications
  async unsubscribe(subscription) {
    if (!subscription || !subscription.endpoint) {
      throw new Error("Invalid push subscription.");
    }

    const response = await fetch(`${BASE_URL}/subscribe`, {
      method: "DELETE",
      headers: authHeaders(),
      body: JSON.stringify({
        endpoint: subscription.endpoint,
      }),
    });

    return await handleResponse(response);
  },
};
