import express from "express";
import { randomUUID, createHash } from "node:crypto";
import webpush from "web-push";

export function createWebsiteController(pool) {
  const router = express.Router();
  const sessions = new Map();

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
    webpush.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );
  }

  const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  
  // Public VAPID key for browser Push Notifications
  router.get("/notifications/vapid-public-key", (req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;

    if (!publicKey) {
      return res.status(503).json({
        success: false,
        message: "VAPID_PUBLIC_KEY is not configured."
      });
    }

    return res.json({
      success: true,
      publicKey
    });
  });

  function requireLogin(req, res, next) {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }
    req.websiteToken = token;
    req.websiteUserId = sessions.get(token);
    next();
  }

  
  // GET ALL NOTIFICATIONS
  router.get(
    "/notifications",
    requireLogin,
    asyncRoute(async (req, res) => {
      const [notifications] = await pool.execute(
        `SELECT
          notification_id,
          borrow_id,
          notification_type,
          title,
          message,
          is_read,
          created_at,
          read_at
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 100`,
        [req.websiteUserId]
      );

      return res.json({
        success: true,
        notifications
      });
    })
  );


  // MARK NOTIFICATION AS READ
  router.patch(
    "/notifications/:id/read",
    requireLogin,
    asyncRoute(async (req, res) => {
      const notificationId = req.params.id;

      if (!/^\d+$/.test(notificationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid notification ID."
        });
      }

      const [result] = await pool.execute(
        `UPDATE notifications
         SET is_read = 1,
             read_at = COALESCE(read_at, NOW())
         WHERE notification_id = ?
           AND user_id = ?`,
        [notificationId, req.websiteUserId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Notification not found."
        });
      }

      return res.json({
        success: true,
        message: "Notification marked as read."
      });
    })
  );
  
  // Save browser Push Subscription
  router.post(
    "/notifications/subscribe",
    requireLogin,
    asyncRoute(async (req, res) => {
      if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
        return res.status(503).json({
          success: false,
          message: "VAPID configuration is incomplete."
        });
      }

      const subscription = req.body?.subscription;

      const endpoint = String(subscription?.endpoint || "").trim();
      const p256dh = String(subscription?.keys?.p256dh || "").trim();
      const auth = String(subscription?.keys?.auth || "").trim();

      if (!endpoint || !p256dh || !auth) {
        return res.status(400).json({
          success: false,
          message: "Invalid push subscription."
        });
      }

      const endpointHash = createHash("sha256")
        .update(endpoint)
        .digest("hex");

      await pool.execute(
        `INSERT INTO push_subscriptions
          (user_id, endpoint, endpoint_hash, p256dh, auth)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          user_id = VALUES(user_id),
          endpoint = VALUES(endpoint),
          p256dh = VALUES(p256dh),
          auth = VALUES(auth)`,
        [
          req.websiteUserId,
          endpoint,
          endpointHash,
          p256dh,
          auth
        ]
      );

      return res.json({
        success: true,
        message: "Push subscription saved successfully."
      });
    })
  );

  // Remove browser Push Subscription
  router.delete(
    "/notifications/subscribe",
    requireLogin,
    asyncRoute(async (req, res) => {
      const endpoint = String(req.body?.endpoint || "").trim();

      if (!endpoint) {
        return res.status(400).json({
          success: false,
          message: "Subscription endpoint is required."
        });
      }

      const endpointHash = createHash("sha256")
        .update(endpoint)
        .digest("hex");

      await pool.execute(
        `DELETE FROM push_subscriptions
         WHERE endpoint_hash = ? AND user_id = ?`,
        [endpointHash, req.websiteUserId]
      );

      return res.json({
        success: true,
        message: "Push subscription removed successfully."
      });
    })
  );

  
  // ==========================================
  // TEST PUSH NOTIFICATION
  // ==========================================

  router.post(
    "/notifications/test",
    requireLogin,
    asyncRoute(async (req, res) => {
      if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
        return res.status(503).json({
          success: false,
          message: "VAPID configuration is incomplete.",
        });
      }

      const [subscriptions] = await pool.query(
        `SELECT subscription_id, endpoint, p256dh, auth
         FROM push_subscriptions
         WHERE user_id = ?`,
        [req.websiteUserId]
      );

      if (!subscriptions.length) {
        return res.status(404).json({
          success: false,
          message: "No push subscription found for this user.",
        });
      }

      const payload = JSON.stringify({
        title: "SMART PUSTAKA",
        message: "Push Notification berjaya! Sistem SMART PUSTAKA kini aktif.",
        url: "/menu",
        tag: "smart-pustaka-test",
      });

      let sent = 0;
      let failed = 0;

      for (const row of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: {
                p256dh: row.p256dh,
                auth: row.auth,
              },
            },
            payload
          );

          sent++;

        } catch (error) {
          console.error(
            "Push delivery error:",
            error.statusCode,
            error.message
          );

          failed++;

          // Remove expired or invalid subscriptions
          if (error.statusCode === 404 || error.statusCode === 410) {
            await pool.execute(
              `DELETE FROM push_subscriptions
               WHERE subscription_id = ?`,
              [row.subscription_id]
            );
          }
        }
      }

      return res.json({
        success: sent > 0,
        message: sent > 0
          ? "Test push notification sent successfully."
          : "Unable to deliver push notification.",
        sent,
        failed,
      });
    })
  );

  // Website login is separate from the RFID/admin dashboard login. Any active user may log in.
  router.post("/auth/login", asyncRoute(async (req, res) => {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Please enter username and password." });
    }
    const [rows] = await pool.query(
      `SELECT user_id, uid, fullname, username, matric_number, role, program
       FROM users WHERE username = ? AND password = ? AND (is_deleted = 0 OR is_deleted IS NULL) LIMIT 1`,
      [username, password]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: "Incorrect username or password." });
    }
    const token = randomUUID();
    sessions.set(token, rows[0].user_id);
    return res.json({ success: true, token, user: rows[0] });
  }));

  router.post("/auth/logout", requireLogin, (req, res) => {
    sessions.delete(req.websiteToken);
    res.json({ success: true });
  });

  // Only return currently borrowed books belonging to the logged-in user.
  router.get("/borrow", requireLogin, asyncRoute(async (req, res) => {
    const userId = Number(req.query.userId);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ success: false, message: "Invalid user." });
    if (userId !== Number(req.websiteUserId)) return res.status(403).json({ success: false, message: "You can only view your own records." });
    const [users] = await pool.query("SELECT user_id FROM users WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) LIMIT 1", [userId]);
    if (!users.length) return res.status(404).json({ success: false, message: "User not found." });
    const [rows] = await pool.query(
      `SELECT borrow_id, user_id, book_id, username, matric_number, program, book_title, author,
              book_publisher, book_published, book_isbn, book_call_number, book_edition, book_page_count,
              borrow_date, due_date, return_date, late_days, fine, payment_status, synopsis, figure
       FROM borrow WHERE user_id = ? AND return_date IS NULL
       ORDER BY borrow_date DESC, borrow_id DESC`, [userId]
    );
    res.json({ success: true, transactions: rows });
  }));

  // Only unpaid fines with an amount greater than zero are shown.
  router.get("/fine", requireLogin, asyncRoute(async (req, res) => {
    const userId = Number(req.query.userId);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ success: false, message: "Invalid user." });
    if (userId !== Number(req.websiteUserId)) return res.status(403).json({ success: false, message: "You can only view your own records." });
    const [rows] = await pool.query(
      `SELECT borrow_id, user_id, book_id, username, matric_number, program, book_title, author,
              book_publisher, book_published, book_isbn, book_call_number, book_edition, book_page_count,
              borrow_date, due_date, return_date, late_days, fine, payment_status, synopsis, figure
       FROM borrow WHERE user_id = ? AND fine > 0 AND LOWER(TRIM(payment_status)) <> 'paid'
       ORDER BY due_date ASC, borrow_id DESC`, [userId]
    );
    res.json({ success: true, transactions: rows });
  }));

  // Search books by title or author
  router.get("/books/search", requireLogin, asyncRoute(async (req, res) => {
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Please enter a book title or author.",
      });
    }

    const searchTerm = `%${query}%`;

    const [books] = await pool.query(
      `SELECT
          book_id,
          uid,
          title,
          author,
          publisher,
          published,
          call_number,
          isbn,
          edition,
          page_count,
          program,
          status,
          synopsis,
          figure
       FROM books
       WHERE title LIKE ? OR author LIKE ?
       ORDER BY title ASC
       LIMIT 50`,
      [searchTerm, searchTerm]
    );

    const results = books.map((book) => ({
      ...book,
      status:
        String(book.status).toLowerCase() === "borrowed"
          ? "Borrowed"
          : "Available",
    }));

    res.json(results);
  }));

  router.use((err, _req, res, _next) => {
    console.error("Website API error:", err);
    res.status(500).json({ success: false, message: "Server error while processing the website request." });
  });
  return router;
}
