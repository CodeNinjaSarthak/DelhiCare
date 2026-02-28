import express from "express";
import { createPatient } from "../controllers/patientController.js";
import { loginUser, myUser, verifyOTPAndRegister } from "../controllers/userController.js";
import { authenticateUser } from "../middlewares/auth.js";
import { initiateRegistration } from "../middlewares/initiateRegistration.js";
import { authRateLimit } from "../middlewares/rateLimiter.js";

const app = express.Router();

app.post("/register",   authRateLimit, initiateRegistration);
app.post("/verify-otp", authRateLimit, verifyOTPAndRegister);
app.post("/login",      authRateLimit, loginUser);
app.get("/me",          authenticateUser, myUser);
app.post("/create-patient", createPatient);

export default app;
