import express from "express";
import { getHospitalStats, getDashboardMetrics } from "../controllers/statsController.js";

const app = express.Router();

app.get("/bedstats", getHospitalStats);
app.get("/metrics",  getDashboardMetrics);

export default app;