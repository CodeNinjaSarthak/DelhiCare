import express from "express";
import { config } from "dotenv";
import { connectDB } from "./config/config.js";
import { errorMiddleware } from "./middlewares/error.js";
import { correlationId } from "./middlewares/correlationId.js";
import { requestLogger } from "./middlewares/requestLogger.js";
import { logger } from "./utils/logger.js";
import { validateEnv } from "./utils/validateEnv.js";
import hospitalRoutes from "./routes/hospitalRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import bedRoutes from "./routes/bedRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import cityRoutes from "./routes/cityRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

config({ path: "./.env" });
validateEnv(); // exits with field-level errors if required vars are missing

connectDB();

const port = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);

export const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true,
    },
});

// ── Global middleware ──────────────────────────────────────────────────────────
// correlationId must come first — requestLogger reads req.requestId.
app.use(correlationId);
app.use(requestLogger);
app.use(express.json());
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(cookieParser());
app.use(session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("api working"));

// Health check — no auth, registered before API routes so it's always reachable.
app.use("/health", healthRoutes);

app.use("/api/v1/user",         userRoutes);
app.use("/api/v1/bed",          bedRoutes);
app.use("/api/v1/hospital",     hospitalRoutes);
app.use("/api/v1/dashboard",    statsRoutes);
app.use("/api/v1/inventory",    inventoryRoutes);
app.use("/api/v1/patient",      patientRoutes);
app.use("/api/v1/city",         cityRoutes);
app.use("/api/v1/notification", notificationRoutes);
app.use("/api/v1/audit",        auditRoutes);

// ── Centralized error handler ─────────────────────────────────────────────────
app.use(errorMiddleware);

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
    logger.info("socket connected", { socketId: socket.id });

    socket.on("joinHospital", (hospitalId) => {
        socket.join(`hospital_${hospitalId}`);
        logger.info("socket joined hospital room", { socketId: socket.id, hospitalId });
    });

    socket.on("disconnect", () => {
        logger.info("socket disconnected", { socketId: socket.id });
    });
});

server.listen(port, () =>
    logger.info(`server running on http://localhost:${port}`)
);
