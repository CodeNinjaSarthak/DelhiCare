import { z } from 'zod';

// Validated at process startup (before connectDB) — fail fast with a clear,
// field-level error message rather than a cryptic runtime crash later.
//
// Rules:
//   Required: MONGO_URL, JWT_SECRET — server cannot function without these.
//   Optional: PORT, NODE_ENV, LOG_LEVEL — safe defaults are provided.
//   Optional (Twilio): server starts without them but SMS will fail at runtime.
//     Acceptable for local dev; document in .env.example.

const schema = z.object({
    NODE_ENV:  z
        .enum(['development', 'production', 'test'])
        .default('development'),

    PORT: z
        .string()
        .regex(/^\d+$/, 'PORT must be a numeric string')
        .default('4000'),

    LOG_LEVEL: z
        .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
        .default('info'),

    MONGO_URL: z
        .string()
        .min(1, 'MONGO_URL is required — set to your MongoDB connection string'),

    JWT_SECRET: z
        .string()
        .min(32, 'JWT_SECRET must be at least 32 characters for security'),

    // Twilio — optional. Warn at startup when missing so developers know SMS
    // will silently fail, but do not block the server from starting.
    TWILIO_ACCOUNT_SID:           z.string().optional(),
    TWILIO_AUTH_TOKEN:            z.string().optional(),
    TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),
    TWILIO_VERIFY_SERVICE_SID:    z.string().optional(),
});

export const validateEnv = () => {
    // Skip validation in test — Jest sets NODE_ENV=test and mocks app.js entirely.
    if (process.env.NODE_ENV === 'test') return;

    const result = schema.safeParse(process.env);

    if (!result.success) {
        // Logger may not be initialised yet — write directly to stderr.
        console.error('\n[env] ❌ Invalid environment variables:\n');
        for (const [field, messages] of Object.entries(
            result.error.flatten().fieldErrors
        )) {
            console.error(`  ${field}: ${messages.join(', ')}`);
        }
        console.error('\nFix the above variables in your .env file and restart.\n');
        process.exit(1);
    }

    // Warn about missing Twilio config — does not block startup.
    const twilio = [
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN',
        'TWILIO_MESSAGING_SERVICE_SID',
        'TWILIO_VERIFY_SERVICE_SID',
    ];
    const missingTwilio = twilio.filter((k) => !process.env[k]);
    if (missingTwilio.length > 0) {
        console.warn(
            `[env] ⚠ Twilio vars not set (${missingTwilio.join(', ')}) — SMS will fail at runtime.`
        );
    }
};
