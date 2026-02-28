import express from "express";
import { createPatient, requestBedAllotment } from "../controllers/patientController.js";
import { bedRequestRateLimit } from "../middlewares/rateLimiter.js";

const app = express.Router();

app.post("/new",          createPatient);
app.post("/request-bed", bedRequestRateLimit, requestBedAllotment);

export default app;
