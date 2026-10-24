
import axios from "axios";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5003/api";

export const bookService = {
    search: async (query) => {
        const token = localStorage.getItem("token");

        return axios.get(`${API_URL}/website/books/search`, {
            params: { q: query },
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
    },
};
