import "bootstrap/dist/css/bootstrap.min.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import "./borrow.css";

import maraLogo from "../assets/Mara.png";
import tvetmaraLogo from "../assets/Tmsp.png";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5003/api";

function getFigureSrc(figure) {
    if (!figure || typeof figure !== "string") {
        return "";
    }

    const value = figure.trim();

    if (!value) {
        return "";
    }

    // Gambar sudah dalam format Data URL
    if (value.startsWith("data:image/")) {
        return value;
    }

    // Gambar dalam format Base64 tanpa prefix
    return `data:image/jpeg;base64,${value}`;
}


function Borrow({ user }) {
    const navigate = useNavigate();

    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchBorrow = async () => {
            if (!user?.user_id) {
                setLoading(false);
                setError("User information not found.");
                return;
            }

            try {
                setLoading(true);
                setError("");

            const response = await axios.get(
                `${API_URL}/website/borrow`,
                {
                    params: { userId: user.user_id },
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token") || ""}`
                    },
                }
            );

                if (response.data?.success) {
                    setTransactions(
                        Array.isArray(response.data.transactions)
                            ? response.data.transactions
                            : []
                    );
                } else {
                    setTransactions([]);
                    setError("Unable to load borrowing information.");
                }
            } catch (err) {
                console.error(
                    "Error fetching borrowing information:",
                    err
                );

                setError("Unable to load borrowing information.");
            } finally {
                setLoading(false);
            }
        };

        fetchBorrow();
    }, [user?.user_id]);

    const formatDate = (date) => {
        if (!date) return "-";

        const rawDate = String(date);
        const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);

        if (match) {
            return `${match[3]}/${match[2]}/${match[1]}`;
        }

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return rawDate;
        }

        return parsedDate.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "UTC",
        });
    };

    return (
        <div className="borrow-screen container-fluid">
            <div className="borrow-container container">

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

                {/* USER INFORMATION */}
                <div className="row w-100">
                    <div className="col-12 text-center">
                        <h3>Hi</h3>

                        <h2>
                            {user?.username ||
                                user?.nickname ||
                                user?.fullname ||
                                "-"}
                        </h2>

                        <h3>These are your borrowed books</h3>
                    </div>
                </div>

                {/* BORROW INFORMATION */}
                <div className="borrow-content">
                    <h1>NOTICE ‼️</h1>

                    <h3>Book Borrowing Information</h3>

                    {loading ? (
                        <div className="borrow-message">
                            Loading borrowing information...
                        </div>
                    ) : error ? (
                        <div className="borrow-message borrow-error">
                            {error}
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="borrow-message">
                            You have no active borrowed books.
                        </div>
                    ) : (
                        <>
                            <p className="borrow-count">
                                Total borrowed books: {transactions.length}
                            </p>

                            <div className="borrow-list">
                                {transactions.map((transaction) => {
                                    const imageSrc = getFigureSrc(
                                        transaction.figure
                                    );

                                    return (
                                        <div
                                            className="borrow-info"
                                            key={transaction.borrow_id}
                                        >
                                            {/* BOOK IMAGE */}
                                            <div className="borrow-book-image">
                                                {imageSrc ? (
                                                    <img
                                                        src={imageSrc}
                                                        alt={
                                                            transaction.book_title ||
                                                            "Book cover"
                                                        }
                                                        onError={(event) => {
                                                            event.currentTarget.style.display =
                                                                "none";

                                                            const placeholder =
                                                                event.currentTarget
                                                                    .nextElementSibling;

                                                            if (placeholder) {
                                                                placeholder.style.display =
                                                                    "flex";
                                                            }
                                                        }}
                                                    />
                                                ) : null}

                                                <div
                                                    className="book-image-placeholder"
                                                    style={{
                                                        display: imageSrc
                                                            ? "none"
                                                            : "flex",
                                                    }}
                                                >
                                                    No Image
                                                </div>
                                            </div>

                                            {/* BOOK INFORMATION */}
                                            <div className="borrow-book-details">
                                                <div className="info-row">
                                                    <span className="info-label">
                                                        Book's Title:
                                                    </span>

                                                    <span className="info-value">
                                                        {transaction.book_title || "-"}
                                                    </span>
                                                </div>

                                                <div className="info-row">
                                                    <span className="info-label">
                                                        Author:
                                                    </span>

                                                    <span className="info-value">
                                                        {transaction.author || "-"}
                                                    </span>
                                                </div>

                                                <div className="info-row">
                                                    <span className="info-label">
                                                        Borrow Date:
                                                    </span>

                                                    <span className="info-value">
                                                        {formatDate(
                                                            transaction.borrow_date
                                                        )}
                                                    </span>
                                                </div>

                                                <div className="info-row">
                                                    <span className="info-label">
                                                        Due Date:
                                                    </span>

                                                    <span className="info-value">
                                                        {formatDate(
                                                            transaction.due_date
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* BACK BUTTON */}
                <button
                    type="button"
                    className="borrow-back-button"
                    onClick={() => navigate("/menu")}
                >
                    ← Back
                </button>

                {/* SLOGAN */}
                <div className="slogan">
                    Building Talent | Generating Future
                </div>
            </div>
        </div>
    );
}

export default Borrow;
