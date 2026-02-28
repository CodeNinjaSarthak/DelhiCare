import dotenv from 'dotenv';
dotenv.config();
import twilio from 'twilio';
import { logger } from './logger.js';

const accountSid          = process.env.TWILIO_ACCOUNT_SID;
const authToken           = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const client              = twilio(accountSid, authToken);

export const sendSms = async (to, message) => {
    try {
        const sms = await client.messages.create({
            body: message,
            messagingServiceSid,
            to,
        });
        logger.info('SMS sent', { to, sid: sms.sid });
        return sms.sid;
    } catch (error) {
        logger.error('SMS send failed', { to, error: error.message });
        throw new Error(`Failed to send SMS: ${error.message}`);
    }
};
