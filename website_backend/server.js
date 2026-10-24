import "dotenv/config";
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";

const app = express();
const PORT = Number(process.env.PORT || 5003);
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "library_db",
  waitForConnections: true, connectionLimit: 10, dateStrings: true,
});
app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "website" }));
import { createWebsiteController } from "./website_controller.js";
app.use("/api/website", createWebsiteController(pool));
app.listen(PORT, "0.0.0.0", () => console.log("website backend running on port " + PORT));
