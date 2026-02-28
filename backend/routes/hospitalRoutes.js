import express from "express";
import {
    loginHospital,
    registerHospital,
    dischargePatient,
    getHospitalPatients,
    getHospitalQueue,
    cancelQueueEntry,
    getPolicy,
    updatePolicy,
    getMe,
} from "../controllers/hospitalController.js";
import { authenticateHospital } from "../middlewares/auth.js";
import { authRateLimit } from "../middlewares/rateLimiter.js";

const app = express.Router();

app.post("/register", authRateLimit, registerHospital);
app.post("/login",    authRateLimit, loginHospital);

app.patch("/discharge/:admissionId", authenticateHospital, dischargePatient);
app.get("/patients",                 authenticateHospital, getHospitalPatients);

app.get("/queue",              authenticateHospital, getHospitalQueue);
app.delete("/queue/:queueId",  authenticateHospital, cancelQueueEntry);

app.get("/policy", authenticateHospital, getPolicy);
app.put("/policy", authenticateHospital, updatePolicy);
app.get("/me",     authenticateHospital, getMe);

export default app;
