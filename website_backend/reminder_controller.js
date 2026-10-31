
import express from "express";
import webpush from "web-push";

export function createReminderController(pool) {
  const router = express.Router();

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  const reminderSecret = process.env.REMINDER_SECRET;

  if (publicKey && privateKey && subject) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }

  const asyncRoute = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

  // Create a notification and send push only when it is newly inserted.
  async function createAndSendNotification({
    userId,
    borrowId,
    type,
    title,
    message,
    dedupeKey,
  }) {
    const [insertResult] = await pool.execute(
      `INSERT IGNORE INTO notifications
        (user_id, borrow_id, notification_type, title, message, dedupe_key)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, borrowId, type, title, message, dedupeKey]
    );

    // Existing dedupe_key means this reminder was already created.
    if (insertResult.affectedRows === 0) {
      return { created: false, sent: 0, failed: 0 };
    }

    const [subscriptions] = await pool.execute(
      `SELECT subscription_id, endpoint, p256dh, auth
       FROM push_subscriptions
       WHERE user_id = ?`,
      [userId]
    );

    let sent = 0;
    let failed = 0;

    if (!publicKey || !privateKey || !subject) {
      return { created: true, sent, failed: subscriptions.length };
    }

    const payload = JSON.stringify({
      title,
      message,
      url: "/menu",
      tag: dedupeKey,
    });

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload
        );
        sent++;
      } catch (error) {
        failed++;
        console.error(
          `Push failed for subscription ${subscription.subscription_id}:`,
          error.statusCode || error.message
        );

        // Remove expired or invalid browser subscriptions.
        if (error.statusCode === 404 || error.statusCode === 410) {
          await pool.execute(
            `DELETE FROM push_subscriptions WHERE subscription_id = ?`,
            [subscription.subscription_id]
          );
        }
      }
    }

    return { created: true, sent, failed };
  }

  // Run reminder checks. Protected by a secret for GitHub Actions.
  router.post(
    "/run",
    asyncRoute(async (req, res) => {
      if (!reminderSecret) {
        return res.status(503).json({
          success: false,
          message: "REMINDER_SECRET is not configured.",
        });
      }

      const suppliedSecret = String(
        req.headers["x-reminder-secret"] || ""
      );

      if (suppliedSecret !== reminderSecret) {
        return res.status(401).json({
          success: false,
          message: "Invalid reminder secret.",
        });
      }

      const [dueTomorrow] = await pool.execute(
        `SELECT borrow_id, user_id, book_title, due_date
         FROM borrow
         WHERE return_date IS NULL
           AND DATE(due_date) = CURDATE() + INTERVAL 1 DAY`
      );

      const [dueToday] = await pool.execute(
        `SELECT borrow_id, user_id, book_title, due_date
         FROM borrow
         WHERE return_date IS NULL
           AND DATE(due_date) = CURDATE()`
      );

      const [overdue] = await pool.execute(
        `SELECT borrow_id, user_id, book_title, due_date
         FROM borrow
         WHERE return_date IS NULL
           AND DATE(due_date) < CURDATE()`
      );

      const [fineDue] = await pool.execute(
        `SELECT borrow_id, user_id, book_title, fine, payment_status
         FROM borrow
         WHERE fine > 0
           AND LOWER(TRIM(payment_status)) = 'not pay'`
      );

      const malaysiaDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kuala_Lumpur",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      const summary = {
        due_tomorrow: dueTomorrow.length,
        due_today: dueToday.length,
        overdue: overdue.length,
        fine_due: fineDue.length,
        notifications_created: 0,
        push_sent: 0,
        push_failed: 0,
      };

      async function processRows(rows, type, makeContent) {
        for (const row of rows) {
          const content = makeContent(row);
          const dedupeKey =
            `borrow:${row.borrow_id}:${type}:${malaysiaDate}`;

          const result = await createAndSendNotification({
            userId: row.user_id,
            borrowId: row.borrow_id,
            type,
            title: content.title,
            message: content.message,
            dedupeKey,
          });

          if (result.created) summary.notifications_created++;
          summary.push_sent += result.sent;
          summary.push_failed += result.failed;
        }
      }

      await processRows(dueTomorrow, "due_tomorrow", (row) => ({
        title: "Book Due Tomorrow",
        message: `Reminder: "${row.book_title}" is due tomorrow. Please return it on time.`,
      }));

      await processRows(dueToday, "due_today", (row) => ({
        title: "Book Due Today",
        message: `Reminder: "${row.book_title}" is due today. Please return it today.`,
      }));

      await processRows(overdue, "overdue", (row) => ({
        title: "Overdue Book",
        message: `The book "${row.book_title}" is overdue. Please return it as soon as possible.`,
      }));

      await processRows(fineDue, "fine_due", (row) => ({
        title: "Outstanding Library Fine",
        message: `You have an unpaid fine of RM ${Number(row.fine).toFixed(2)} for "${row.book_title}". Please settle your payment.`,
      }));

      return res.json({
        success: true,
        message: "Daily reminder check completed.",
        date: malaysiaDate,
        summary,
      });
    })
  );

  router.use((error, _req, res, _next) => {
    console.error("Reminder controller error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process daily reminders.",
    });
  });

  return router;
}
