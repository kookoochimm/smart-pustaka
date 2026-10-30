
import "bootstrap/dist/css/bootstrap.min.css";
import "./menu.css";

import { useNavigate } from "react-router-dom";
import { useState } from "react";
import NotificationCentre from "./NotificationCentre";

import { bookService } from "../services/bookService";

import maraLogo from "../assets/Mara.png";
import tvetmaraLogo from "../assets/Tmsp.png";

function Menu({ user, onLogout }) {
    const navigate = useNavigate();

    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [selectedBook, setSelectedBook] = useState(null);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // SEARCH BOOK
    const searchBooks = async (e) => {
        e?.preventDefault();

        const query = search.trim();

        if (!query) {
            setSelectedBook(null);
            setMessage("Please enter a book title or author.");
            return;
        }

        try {
            setLoading(true);
            setMessage("");
            setSelectedBook(null);

            const response = await bookService.search(query);
            const books = response.data;

            console.log("BOOK SEARCH RESPONSE:", books);

            if (books.length > 0) {
                setSelectedBook(books);
            } else {
                setMessage("No books found.");
            }
        } catch (error) {
            console.error("Search book error:", error);

            if (error.response?.status === 401) {
                setMessage("Session expired. Please login again.");
            } else {
                setMessage("Unable to search books. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    // CLOSE NOTIFICATION
    const closePopup = () => {
        setSelectedBook(null);
        setMessage("");
        setSearch("");
    };

    // LOG OUT
    const handleLogout = () => {
        // CLEAR LOGIN SESSION
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        // CLEAR ANY SAVED LOGIN INPUTS
        sessionStorage.removeItem("loginUsername");
        sessionStorage.removeItem("loginPassword");

        // RESET USER STATE
        onLogout();

        // RETURN TO LOGIN PAGE
        navigate("/login", { replace: true });
    };

    return (
        <div className="menu-screen container-fluid">
            <div className="menu-container container">

                {/* LOGOS */}
                <div className="logos">
                    <img
                        src={maraLogo}
                        alt="MARA Logo"
                        className="mara-logo"
                    />

                    <img
                        src={tvetmaraLogo}
                        alt="TVETMARA Logo"
                        className="tvetmara-logo"
                    />
                </div>

                {/* NOTIFICATION BELL */}
                <button
                    type="button"
                    className="notification-bell-btn"
                    onClick={() => setShowNotifications(true)}
                    aria-label={`Open notifications, ${unreadCount} unread`}
                >
                    <span aria-hidden="true">🔔</span>
                    {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                </button>

                {showNotifications && (
                    <NotificationCentre
                        onClose={() => setShowNotifications(false)}
                        onUnreadChange={setUnreadCount}
                    />
                )}

                {/* WELCOME */}
                <div className="row w-100">
                    <div className="col-12 text-center">
                        <h3>Welcome Back</h3>
                        <h2>{user?.username || "-"}</h2>
                        <h3>To Smart Pustaka</h3>
                    </div>
                </div>

                {/* SEARCH */}
                <form
                    className="book-search-container"
                    onSubmit={searchBooks}
                >
                    <input
                        type="text"
                        className="book-search"
                        placeholder="Search book title or author..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <button
                        type="submit"
                        className="search-btn"
                        disabled={loading}
                    >
                        {loading ? "Searching..." : "Search"}
                    </button>
                </form>

                {/* SEARCH RESULT POPUP */}
                {(selectedBook || message) && (
                    <div
                        className="book-popup-overlay"
                        onClick={closePopup}
                    >
                        <div
                            className="book-popup"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="book-popup-title"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* CLOSE BUTTON */}
                            <button
                                type="button"
                                className="popup-close-btn"
                                onClick={closePopup}
                                aria-label="Close popup"
                            >
                                &times;
                            </button>

                            <h3 id="book-popup-title">
                                {selectedBook
                                    ? "BOOK INFORMATION"
                                    : "SEARCH RESULT"}
                            </h3>

                            {selectedBook ? (
                                <div className="popup-info">
                                    {selectedBook.map((book) => (
                                        <div
                                            className="popup-book-item"
                                            key={book.book_id}
                                        >
                                            {/* BOOK IMAGE */}
                                            <div className="popup-book-image">
                                                {book.figure ? (
                                                    <img
                                                        src={book.figure}
                                                        alt={book.title}
                                                        className="book-figure"
                                                    />
                                                ) : (
                                                    <div className="no-book-image">
                                                        No Image Available
                                                    </div>
                                                )}
                                            </div>

                                            {/* BOOK TITLE */}
                                            <div className="popup-label">
                                                Book Title
                                            </div>

                                            <div className="popup-value">
                                                {book.title}
                                            </div>

                                            {/* AUTHOR */}
                                            <div className="popup-label">
                                                Author
                                            </div>

                                            <div className="popup-value">
                                                {book.author}
                                            </div>

                                            {/* SYNOPSIS */}
                                            <div className="popup-label">
                                                About This Book
                                            </div>

                                            <div className="popup-value">
                                                {book.synopsis ||
                                                    "Synopsis not available."}
                                            </div>

                                            {/* STATUS */}
                                            <div className="popup-label">
                                                Status
                                            </div>

                                            <div
                                                className={
                                                    book.status === "Borrowed"
                                                        ? "popup-status borrowed"
                                                        : "popup-status available"
                                                }
                                            >
                                                {book.status}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="popup-message">
                                    {message}
                                </p>
                            )}

                            <button
                                type="button"
                                className="popup-okay-btn"
                                onClick={closePopup}
                            >
                                Okay
                            </button>
                        </div>
                    </div>
                )}

                {/* MENU BUTTONS */}
                <div className="menu-buttons">
                    <button
                        type="button"
                        className="menu-btn borrowed-btn"
                        onClick={() => navigate("/borrow")}
                    >
                        <span className="btn-icon">📚</span>
                        <span>Borrow Information</span>
                    </button>

                    <button
                        type="button"
                        className="menu-btn return-btn"
                        onClick={() => navigate("/fine")}
                    >
                        <span className="btn-icon">💰</span>
                        <span>Fine Information</span>
                    </button>
                </div>

                {/* LOG OUT */}
                <button
                    type="button"
                    className="logout-btn"
                    onClick={handleLogout}
                >
                    <span>👤</span> Log Out
                </button>

                {/* SLOGAN */}
                <div className="slogan">
                    Building Talent | Generating Future
                </div>
            </div>
        </div>
    );
}

export default Menu;
