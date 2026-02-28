// ─────────────────────────────────────────────────────────────────────────────
// auditService.test.js
//
// AuditLog model is mocked — no real DB.
// Verifies that logAudit creates records in the normal case and swallows errors
// (non-fatal) in the failure case.
// ─────────────────────────────────────────────────────────────────────────────

import { logAudit } from '../services/auditService.js';
import { AuditLog } from '../models/AuditLogModel.js';

jest.mock('../models/AuditLogModel.js', () => ({
    AuditLog: {
        create: jest.fn(),
    },
}));

// Suppress logger output in tests
jest.mock('../utils/logger.js', () => ({
    logger: {
        warn:  jest.fn(),
        error: jest.fn(),
        info:  jest.fn(),
    },
}));

import { logger } from '../utils/logger.js';

// ── Shared fixture ────────────────────────────────────────────────────────────

const makePayload = (overrides = {}) => ({
    hospitalId: 'hospital-abc',
    patientId:  'patient-001',
    action:     'PATIENT_ADMITTED',
    resourceId: 'admission-001',
    metadata:   { department: 'ICU', bedId: 'bed-001' },
    requestId:  'req-123',
    ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('logAudit', () => {

    describe('happy path', () => {
        it('calls AuditLog.create with the provided data', async () => {
            AuditLog.create.mockResolvedValue({});
            const payload = makePayload();

            await logAudit(payload);

            expect(AuditLog.create).toHaveBeenCalledWith(payload);
        });

        it('resolves without throwing when create succeeds', async () => {
            AuditLog.create.mockResolvedValue({});
            await expect(logAudit(makePayload())).resolves.toBeUndefined();
        });

        it('does not call logger.warn on success', async () => {
            AuditLog.create.mockResolvedValue({});
            await logAudit(makePayload());
            expect(logger.warn).not.toHaveBeenCalled();
        });
    });

    describe('error swallowing', () => {
        it('does not throw when AuditLog.create rejects', async () => {
            AuditLog.create.mockRejectedValue(new Error('mongo timeout'));
            await expect(logAudit(makePayload())).resolves.toBeUndefined();
        });

        it('logs a warn (not error) when create fails', async () => {
            AuditLog.create.mockRejectedValue(new Error('write failed'));
            await logAudit(makePayload());
            expect(logger.warn).toHaveBeenCalledWith(
                'Audit log write failed (non-fatal)',
                expect.objectContaining({ error: 'write failed' })
            );
        });

        it('includes action, hospitalId, patientId, resourceId in the warn', async () => {
            AuditLog.create.mockRejectedValue(new Error('disk full'));
            const payload = makePayload();
            await logAudit(payload);

            expect(logger.warn).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    action:     payload.action,
                    hospitalId: payload.hospitalId,
                    patientId:  payload.patientId,
                    resourceId: payload.resourceId,
                })
            );
        });
    });

    describe('optional fields', () => {
        it('works when patientId is omitted (nullable field)', async () => {
            AuditLog.create.mockResolvedValue({});
            const payload = makePayload({ patientId: undefined });
            await expect(logAudit(payload)).resolves.toBeUndefined();
            expect(AuditLog.create).toHaveBeenCalledWith(payload);
        });

        it('works when requestId is null', async () => {
            AuditLog.create.mockResolvedValue({});
            const payload = makePayload({ requestId: null });
            await expect(logAudit(payload)).resolves.toBeUndefined();
        });
    });
});
