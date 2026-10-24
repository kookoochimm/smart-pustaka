import express from "express";
import { randomUUID } from "node:crypto";

export function createWebsiteController(pool) {
  const router = express.Router();
  const sessions = new Map();
  const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  function requireLogin(req, res, next) {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
    if (!token || !sessions.has(token)) {
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }
    req.websiteToken = token;
    req.websiteUserId = sessions.get(token);
    next();
  }

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
