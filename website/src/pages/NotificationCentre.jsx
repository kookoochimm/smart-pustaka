import { useCallback, useEffect, useState } from "react";
import { notificationService, urlBase64ToUint8Array } from "../services/notificationService";
import "./notification.css";

export default function NotificationCentre({ onClose, onUnreadChange }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [permission, setPermission] = useState(typeof Notification === "undefined" ? "unsupported" : Notification.permission);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await notificationService.getAll();
      const rows = Array.isArray(data.notifications) ? data.notifications : [];
      setItems(rows);
      const count = Number(data.unread_count || 0);
      setUnread(count);
      onUnreadChange?.(count);
    } catch (error) {
      setMessage(error.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const enablePush = async () => {
    setMessage("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        throw new Error("This browser does not support web push notifications.");
      }
      if (!window.isSecureContext) throw new Error("Push notifications require HTTPS (or localhost for testing).");
      setBusy(true);
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") throw new Error("Notification permission was not granted.");

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const publicKey = await notificationService.getPublicKey();
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      await notificationService.subscribe(subscription.toJSON());
      setMessage("Notifications are enabled on this device.");
    } catch (error) {
      setMessage(error.message || "Unable to enable notifications.");
    } finally {
      setBusy(false);
    }
  };

  const markAsRead = async (item) => {
    if (item.is_read || item.read_at) return;
    const id = item.notification_id ?? item.id;
    if (id == null) return;
    try {
      await notificationService.markRead(id);
      setItems((current) => current.map((row) => (row === item ? { ...row, is_read: 1, read_at: new Date().toISOString() } : row)));
      setUnread((current) => {
        const next = Math.max(0, current - 1);
        onUnreadChange?.(next);
        return next;
      });
    } catch (error) {
      setMessage(error.message || "Unable to mark notification as read.");
    }
  };

  return (
    <div className="notification-overlay" onClick={onClose}>
      <section className="notification-panel" role="dialog" aria-modal="true" aria-labelledby="notification-title" onClick={(e) => e.stopPropagation()}>
        <div className="notification-header">
          <div><h2 id="notification-title">Notifications</h2><p>{unread} unread</p></div>
          <button className="notification-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <button className="enable-notification-btn" onClick={enablePush} disabled={busy || permission === "unsupported" || permission === "denied"}>
          {busy ? "Enabling..." : permission === "granted" ? "Enable / Sync This Device" : "Enable Push Notifications"}
        </button>
        {permission === "denied" && <p className="notification-hint">Notifications are blocked in browser settings. Allow them there before trying again.</p>}
        {message && <p className="notification-message" role="status">{message}</p>}

        <div className="notification-list">
          {loading ? <p className="notification-empty">Loading notifications...</p> : items.length === 0 ? <p className="notification-empty">No notifications yet.</p> : items.map((item, index) => {
            const read = Boolean(item.is_read || item.read_at);
            return (
              <button key={item.notification_id ?? item.id ?? index} className={`notification-item ${read ? "read" : "unread"}`} onClick={() => markAsRead(item)}>
                <span className="notification-dot" />
                <span className="notification-item-content">
                  <strong>{item.title || "SMART PUSTAKA"}</strong>
                  <span>{item.message || item.body || "You have a new notification."}</span>
                  <small>{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
