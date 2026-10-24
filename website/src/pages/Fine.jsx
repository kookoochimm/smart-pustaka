import "bootstrap/dist/css/bootstrap.min.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./fine.css";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5003/api";

import maraLogo from "../assets/Mara.png";
import tvetmaraLogo from "../assets/Tmsp.png";

function Fine({ user }) {
    const navigate = useNavigate();

    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const formatDate = (date) => {
        if (!date) return "-";

        // Preserve the date from MySQL DATETIME without timezone shifting.
        const rawDate = String(date);
        const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) return `${match[3]}/${match[2]}/${match[1]}`;

        const parsedDate = new Date(date);
        if (Number.isNaN(parsedDate.getTime())) return rawDate;

        return parsedDate.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "UTC",
        });
    };

    const formatFine = (fine) => Number(fine ?? 0).toFixed(2);

    useEffect(() => {
        const fetchFines = async () => {
            if (!user?.user_id) {
                setTransactions([]);
                setError("User information not found.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError("");
            
                const response = await axios.get(
                    `${API_URL}/website/fine`,
                    {
                        params: { userId: user.user_id },
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
                        },
                    }
                );

                if (response.data?.success && Array.isArray(response.data.transactions)) {
                    setTransactions(response.data.transactions);
                } else if (response.data?.success && response.data.transaction) {
                    // Backward compatibility if the API returns a single record.
                    setTransactions([response.data.transaction]);
                } else {
                    setTransactions([]);
                }
            } catch (err) {
                console.error(
                    "Error fetching fine information:",
                    err.response?.data || err.message
                );
                setTransactions([]);
                setError(
                    err.response?.data?.message ||
                    "Unable to load fine information."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchFines();
    }, [user?.user_id]);

    const totalFine = transactions.reduce(
        (total, transaction) => total + Number(transaction.fine ?? 0),
        0
    );

    return (
        <div className="fine-screen container-fluid">
            <div className="fine-container container">
                {/* MARA AND TVETMARA LOGOS */}
                <div className="logos">
                    <img src={maraLogo} alt="MARA Logo" className="mara-logo" />
                    <img src={tvetmaraLogo} alt="TVETMARA Logo" className="tvetmara-logo" />
                </div>

                {/* USER INFORMATION */}
                <div className="row w-100">
                    <div className="col-12 text-center">
                        <h3>Hi</h3>
                        <h2>{user?.username || user?.nickname || user?.fullname || "-"}</h2>
                        <h3>These are your unpaid fines</h3>
                    </div>
                </div>

                {/* FINE NOTICE */}
                <div className="fine-content">
                    <h1>NOTICE ‼️</h1>
                    <h3>Kindly pay your fine at the counter</h3>

                    {loading ? (
                        <div className="fine-message">Loading fine information...</div>
                    ) : error ? (
                        <div className="fine-message fine-error">{error}</div>
                    ) : transactions.length === 0 ? (
                        <div className="fine-message">No Fine Record</div>
                    ) : (
                        <>
                            <p className="fine-count">
                                Total books with unpaid fines: {transactions.length}
                            </p>

                            <div className="fine-list">
                                {transactions.map((transaction) => (
                                    <div className="fine-info" key={transaction.borrow_id}>
                                        <div className="fine-book-layout">
                                            <div className="fine-book-image-wrap">
                                                {transaction.figure ? (
                                                    <img
                                                        src={transaction.figure}
                                                        alt={transaction.book_title || "Book cover"}
                                                        className="fine-book-image"
                                                    />
                                                ) : (
                                                    <div className="fine-book-image-placeholder">
                                                        No Book Image
                                                    </div>
                                                )}
                                            </div>
                                            <div className="fine-book-details">
                                        <div className="info-row">
                                            <span className="info-label">Book's Title :</span>
                                            <span className="info-value">{transaction.book_title || "-"}</span>
                                        </div>

                                        <div className="info-row">
                                            <span className="info-label">Author :</span>
                                            <span className="info-value">{transaction.author || "-"}</span>
                                        </div>

                                        <div className="date-pair-grid">
                                            <div className="date-info">
                                                <span className="info-label">Borrow Date :</span>
                                                <span className="info-value">{formatDate(transaction.borrow_date)}</span>
                                            </div>
                                            <div className="date-info">
                                                <span className="info-label">Due Date :</span>
                                                <span className="info-value">{formatDate(transaction.due_date)}</span>
                                            </div>
                                        </div>

                                        <div className="return-fine-grid">
                                            <div className="date-info">
                                                <span className="info-label">Return Date :</span>
                                                <span className="info-value">{formatDate(transaction.return_date)}</span>
                                            </div>
                                            <div className="date-info">
                                                <span className="info-label">Late Days :</span>
                                                <span className="info-value">{Number(transaction.late_days ?? 0)} day(s)</span>
                                            </div>
                                            <div className="date-info">
                                                <span className="info-label">Fine :</span>
                                                <span className="info-value">RM {formatFine(transaction.fine)}</span>
                                            </div>
                                        </div>

                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="fine-total">
                                Total Unpaid Fine: RM {totalFine.toFixed(2)}
                            </div>
                        </>
                    )}
                </div>

                {/* BACK BUTTON */}
                <button
                    type="button"
                    className="fine-back-button"
                    onClick={() => navigate("/menu")}
                >
                    ← Back
                </button>

                {/* SLOGAN */}
                <div className="slogan">Building Talent | Generating Future</div>
            </div>
        </div>
    );
}

export default Fine;
