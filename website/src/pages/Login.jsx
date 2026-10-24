import "bootstrap/dist/css/bootstrap.min.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";

import maraLogo from "../assets/Mara.png";
import tvetmaraLogo from "../assets/Tmsp.png";

function Login({ setUser }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    // CLEAR LOGIN INFORMATION WHEN LOGIN PAGE OPENS
    useEffect(() => {
        setUsername("");
        setPassword("");
        setError("");

        sessionStorage.removeItem("loginUsername");
        sessionStorage.removeItem("loginPassword");
    }, []);

    // LOGIN
    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");
        setLoading(true);

        try {

            const API_URL =
                import.meta.env.VITE_API_URL || "http://localhost:5003/api";
            
            const response = await fetch(
                `${API_URL}/website/auth/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        username: username.trim(),
                        password: password,
                    }),
                }
            );

            const data = await response.json();

            console.log(
                "Login API response:",
                response.status,
                data
            );

            if (response.ok && data.success && data.user) {
                // SAVE SESSION INFORMATION ONLY
                if (data.token) {
                    localStorage.setItem("token", data.token);
                } else {
                    localStorage.removeItem("token");
                }

                localStorage.setItem(
                    "user",
                    JSON.stringify(data.user)
                );

                setUser(data.user);

                // CLEAR INPUT FIELDS
                setUsername("");
                setPassword("");
                setError("");

                navigate("/menu", { replace: true });
            } else {
                setError(
                    data.message ||
                    data.error ||
                    `Login failed (HTTP ${response.status})`
                );
            }
        } catch (err) {
            console.error("Login error:", err);
            setError("Unable to connect to server");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-screen container-fluid">
            <div className="login-container container">

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

                {/* WELCOME */}
                <div className="row w-100">
                    <div className="col-12 text-center">
                        <h3>WELCOME TO</h3>
                        <h2>SMART PUSTAKA</h2>
                        <h3>TVETMARA SUNGAI PETANI</h3>
                    </div>
                </div>

                {/* LOGIN FORM */}
                <form
                    onSubmit={handleSubmit}
                    autoComplete="off"
                >
                    <input
                        type="text"
                        name="username"
                        placeholder="Enter username"
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value);
                            setError("");
                        }}
                        autoComplete="off"
                        required
                    />

                    <input
                        type="password"
                        name="password"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setError("");
                        }}
                        autoComplete="new-password"
                        required
                    />

                    {/* ERROR MESSAGE */}
                    {error && (
                        <div
                            className="login-error"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    {/* SUBMIT */}
                    <button
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? "CHECKING..." : "SUBMIT"}
                    </button>
                </form>

                {/* SLOGAN */}
                <div className="slogan">
                    Building Talent | Generating Future
                </div>

            </div>
        </div>
    );
}

export default Login;
