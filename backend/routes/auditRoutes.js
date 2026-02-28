import express from "express";
import { getAuditLogs } from "../controllers/auditController.js";
import { authenticateHospital } from "../middlewares/auth.js";

const app = express.Router();

app.get("/", authenticateHospital, getAuditLogs);

export default app;
