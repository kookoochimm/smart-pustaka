
import { useCallback, useEffect, useState } from "react";
import {
  notificationService,
  urlBase64ToUint8Array,
} from "../services/notificationService";

import "./notification.css";

export default function NotificationCentre({
  onClose,
  onUnreadChange,
}) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [permission, setPermission] = useState(
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission
  );

  // ==========================================
  // LOAD NOTIFICATIONS
  // ==========================================

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);

      const data = await notificationService.getAll();

      const rows = Array.isArray(data.notifications)
        ? data.notifications
        : [];

      setItems(rows);

      const count = Number(
        data.unread_count ??
        rows.filter((item) => !item.is_read && !item.read_at).length
      );

      setUnread(count);
      onUnreadChange?.(count);

    } catch (error) {
      console.error("Load notifications error:", error);
      setMessage(error.message || "Unable to load notifications.");

    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);


  // ==========================================
  // ENABLE PUSH NOTIFICATIONS
  // ==========================================

  const enablePush = async () => {
    setMessage("");
    setBusy(true);

    try {
      console.log("STEP 1: Checking browser support");

      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        throw new Error(
          "This browser does not support Push Notifications."
        );
      }

      if (!window.isSecureContext) {
        throw new Error(
          "Push Notifications require HTTPS or localhost."
        );
      }

      // --------------------------------------
      // STEP 1: REQUEST PERMISSION
      // --------------------------------------

      console.log("STEP 2: Requesting notification permission");

      let currentPermission = Notification.permission;

      if (currentPermission === "default") {
        currentPermission = await Notification.requestPermission();
      }

      setPermission(currentPermission);

      if (currentPermission !== "granted") {
        throw new Error(
          "Notification permission was not granted."
        );
      }

      console.log("Permission granted:", currentPermission);


      // --------------------------------------
      // STEP 2: SERVICE WORKER
      // --------------------------------------

      console.log("STEP 3: Waiting for Service Worker");

      const registration = await navigator.serviceWorker.ready;

      if (!registration.active) {
        throw new Error(
          "Service Worker is not active. Please reload the application."
        );
      }

      console.log(
        "Service Worker active:",
        registration.active.scriptURL
      );


      // --------------------------------------
      // STEP 3: GET EXISTING SUBSCRIPTION
      // --------------------------------------

      console.log("STEP 4: Checking existing subscription");

      let subscription =
        await registration.pushManager.getSubscription();


      // --------------------------------------
      // STEP 4: CREATE NEW SUBSCRIPTION
      // --------------------------------------

      if (!subscription) {
        console.log("STEP 5: Getting VAPID public key");

        const publicKey = await notificationService.getPublicKey();

        if (!publicKey) {
          throw new Error("VAPID public key is empty.");
        }

        console.log(
          "VAPID public key received. Length:",
          publicKey.length
        );

        console.log("STEP 6: Converting VAPID public key");

        const applicationServerKey =
          urlBase64ToUint8Array(publicKey);

        console.log(
          "VAPID Uint8Array length:",
          applicationServerKey.length
        );

        console.log("STEP 7: Creating Push Subscription");

        try {
          subscription =
            await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey,
            });

        } catch (error) {
          console.error(
            "PushManager.subscribe failed:",
            error.name,
            error.message
          );

          throw new Error(
            `Push subscription failed (${error.name}): ${error.message}`
          );
        }
      } else {
        console.log("Existing subscription found.");
      }


      // --------------------------------------
      // STEP 5: SAVE SUBSCRIPTION TO BACKEND
      // --------------------------------------

      console.log("STEP 8: Saving subscription to backend");

      const subscriptionJSON = subscription.toJSON();

      if (
        !subscriptionJSON.endpoint ||
        !subscriptionJSON.keys?.p256dh ||
        !subscriptionJSON.keys?.auth
      ) {
        throw new Error(
          "Browser returned an incomplete push subscription."
        );
      }

      const result = await notificationService.subscribe(
        subscriptionJSON
      );

      console.log("Subscription saved:", result);

      setMessage(
        "Notifications are enabled on this device."
      );

      console.log(
        "SUCCESS: Push Notifications enabled successfully!"
      );

    } catch (error) {
      console.error("ENABLE PUSH ERROR:", error);

      setMessage(
        error.message || "Unable to enable notifications."
      );

    } finally {
      setBusy(false);
    }
  };


  // ==========================================
  // MARK NOTIFICATION AS READ
  // ==========================================

  const markAsRead = async (item) => {
    if (item.is_read || item.read_at) return;

    const id = item.notification_id ?? item.id;

    if (id == null) return;

    try {
      await notificationService.markRead(id);

      setItems((current) =>
        current.map((row) =>
          row === item
            ? {
                ...row,
                is_read: 1,
                read_at: new Date().toISOString(),
              }
            : row
        )
      );

      setUnread((current) => {
        const next = Math.max(0, current - 1);
        onUnreadChange?.(next);
        return next;
      });

    } catch (error) {
      console.error("Mark notification read error:", error);

      setMessage(
        error.message || "Unable to mark notification as read."
      );
    }
  };


  // ==========================================
  // USER INTERFACE
  // ==========================================

  return (
    <div
      className="notification-overlay"
      onClick={onClose}
    >
      <section
        className="notification-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-title"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="notification-header">

          <div>
            <h2 id="notification-title">
              Notifications
            </h2>

            <p>{unread} unread</p>
          </div>

          <button
            className="notification-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>

        </div>


        {/* ENABLE PUSH BUTTON */}

        <button
          className="enable-notification-btn"
          onClick={enablePush}
          disabled={
            busy ||
            permission === "unsupported" ||
            permission === "denied"
          }
        >
          {busy
            ? "Enabling..."
            : permission === "granted"
            ? "Enable / Sync This Device"
            : "Enable Push Notifications"}
        </button>


        {/* PERMISSION MESSAGE */}

        {permission === "denied" && (
          <p className="notification-hint">
            Notifications are blocked in browser settings.
            Please allow notifications before trying again.
          </p>
        )}


        {/* ERROR / SUCCESS MESSAGE */}

        {message && (
          <p
            className="notification-message"
            role="status"
          >
            {message}
          </p>
        )}


        {/* NOTIFICATION LIST */}

        <div className="notification-list">

          {loading ? (
            <p className="notification-empty">
              Loading notifications...
            </p>

          ) : items.length === 0 ? (
            <p className="notification-empty">
              No notifications yet.
            </p>

          ) : (
            items.map((item, index) => {

              const read = Boolean(
                item.is_read || item.read_at
              );

              return (
                <button
                  key={
                    item.notification_id ??
                    item.id ??
                    index
                  }
                  className={`notification-item ${
                    read ? "read" : "unread"
                  }`}
                  onClick={() => markAsRead(item)}
                >

                  <span className="notification-dot" />

                  <span className="notification-item-content">

                    <strong>
                      {item.title || "SMART PUSTAKA"}
                    </strong>

                    <span>
                      {item.message ||
                        item.body ||
                        "You have a new notification."}
                    </span>

                    <small>
                      {item.created_at
                        ? new Date(
                            item.created_at
                          ).toLocaleString()
                        : ""}
                    </small>

                  </span>

                </button>
              );
            })
          )}

        </div>

      </section>
    </div>
  );
}
