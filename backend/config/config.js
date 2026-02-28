import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

export const connectDB = async () => {
    await mongoose.connect(process.env.MONGO_URL || "");
    logger.info("db connected");
};
