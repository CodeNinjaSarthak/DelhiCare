// ─────────────────────────────────────────────────────────────────────────────
// bedAllocationService.test.js
//
// All Mongoose models, sendSms, and io are mocked — no real DB connection.
// jest.config.cjs sets clearMocks:true, so mock.calls are reset between tests
// automatically. mockReturnValue / mockResolvedValue must be re-applied per test.
//
// jest.mock() calls are hoisted to the top of the file by babel-plugin-jest-hoist,
// so they run before any import statements. Variables declared in the module body
// are NOT available inside mock factory functions — only inline jest.fn() is safe.
// ─────────────────────────────────────────────────────────────────────────────

import { reEvaluateQueue } from '../services/bedAllocationService.js';
import { Bed }             from '../models/bedModel.js';
import { WaitingQueue }    from '../models/WaitingQueueModel.js';
import { PatientAdmission } from '../models/patientAdmissionModel.js';
import { Patient }         from '../models/patientModel.js';
import { sendSms }         from '../utils/sendSMS.js';
import { io }              from '../app.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../models/bedModel.js', () => ({
    Bed: {
        countDocuments:    jest.fn(),
        findOneAndUpdate:  jest.fn(),
        findByIdAndUpdate: jest.fn(),
    },
}));

jest.mock('../models/WaitingQueueModel.js', () => ({
    WaitingQueue: {
        findOneAndUpdate:  jest.fn(),
        findByIdAndUpdate: jest.fn(),
    },
}));

jest.mock('../models/patientAdmissionModel.js', () => ({
    PatientAdmission: {
        findOne: jest.fn(),
        create:  jest.fn(),
    },
}));

jest.mock('../models/patientModel.js', () => ({
    Patient: {
        findById: jest.fn(),
    },
}));

// sendSms is fire-and-forget — mock to resolve silently so the service doesn't
// generate unhandled rejections during tests.
jest.mock('../utils/sendSMS.js', () => ({
    sendSms: jest.fn().mockResolvedValue('mock-sid'),
}));

// io.to().emit() — mock the chain; we assert on io.to being called correctly.
jest.mock('../app.js', () => ({
    io: {
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    },
}));

// ── Shared fixtures ───────────────────────────────────────────────────────────

const HOSPITAL_ID  = 'hospital-abc';
const PATIENT_ID_1 = 'patient-001';
const PATIENT_ID_2 = 'patient-002';

const makeBed = (id = 'bed-001') => ({ _id: id });

const makeQueueEntry = (patientId = PATIENT_ID_1, score = 80) => ({
    _id:       'queue-001',
    patientId,
    score,
    admittedAt: new Date(),
});

const makeExistingAdmission = () => ({ _id: 'admission-existing' });

const makePatient = () => ({
    contactNumber: '9876543210',
    emergencyContact: { contactNumber: '9876543211' },
});

// Suppress console.info / console.error output during tests — the service logs
// structured messages on every path. Suppress to keep test output readable.
// Restore after the suite so other test files are unaffected.
beforeAll(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
    console.info.mockRestore();
    console.error.mockRestore();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('reEvaluateQueue', () => {

    // ── No free beds ──────────────────────────────────────────────────────────

    describe('no free beds', () => {
        it('returns allocatedCount 0 and does not touch the queue', async () => {
            Bed.countDocuments.mockResolvedValue(0);       // maxIterations = 1
            Bed.findOneAndUpdate.mockResolvedValue(null);  // no bed available

            const result = await reEvaluateQueue(HOSPITAL_ID, 'ICU');

            expect(result).toEqual({ allocatedCount: 0 });
            expect(WaitingQueue.findOneAndUpdate).not.toHaveBeenCalled();
            expect(PatientAdmission.create).not.toHaveBeenCalled();
        });
    });

    // ── Priority sort ─────────────────────────────────────────────────────────
    //
    // reEvaluateQueue delegates ordering to MongoDB via the sort option.
    // We cannot test which patient MongoDB would choose (no real DB), but we CAN
    // verify that the correct sort is passed — ensuring MongoDB will rank
    // highest-score patients first, with createdAt as the FIFO tiebreaker.

    describe('priority ordering', () => {
        it('passes score DESC / createdAt ASC sort to WaitingQueue atomic claim', async () => {
            Bed.countDocuments.mockResolvedValue(1);
            // First findOneAndUpdate → returns a bed; second (next loop iteration)
            // would not run because the queue returns null → orphan release → break.
            Bed.findOneAndUpdate.mockResolvedValue(makeBed());
            WaitingQueue.findOneAndUpdate.mockResolvedValue(null); // orphan
            Bed.findByIdAndUpdate.mockResolvedValue({});

            await reEvaluateQueue(HOSPITAL_ID, 'General');

            expect(WaitingQueue.findOneAndUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'Waiting', department: 'General' }),
                expect.any(Object),
                expect.objectContaining({ sort: { score: -1, createdAt: 1 } })
            );
        });
    });

    // ── Orphan bed release ────────────────────────────────────────────────────
    //
    // A free bed exists but no patient is waiting. The bed must be released
    // (isOccupied reset to false) and the loop must stop.

    describe('orphan bed release', () => {
        it('releases the bed when no queue entry exists and stops the loop', async () => {
            const bed = makeBed('bed-orphan');
            Bed.countDocuments.mockResolvedValue(1);
            Bed.findOneAndUpdate.mockResolvedValue(bed);  // bed claimed
            WaitingQueue.findOneAndUpdate.mockResolvedValue(null); // nobody waiting
            Bed.findByIdAndUpdate.mockResolvedValue({});

            const result = await reEvaluateQueue(HOSPITAL_ID, 'Emergency');

            expect(result).toEqual({ allocatedCount: 0 });
            // Bed must be released with isOccupied: false
            expect(Bed.findByIdAndUpdate).toHaveBeenCalledWith(
                bed._id,
                { $set: { isOccupied: false } }
            );
            // Should not have attempted to create an admission
            expect(PatientAdmission.create).not.toHaveBeenCalled();
        });

        it('only runs one iteration when there is exactly one free bed', async () => {
            Bed.countDocuments.mockResolvedValue(1); // maxIterations = 2
            Bed.findOneAndUpdate.mockResolvedValue(makeBed());
            WaitingQueue.findOneAndUpdate.mockResolvedValue(null);
            Bed.findByIdAndUpdate.mockResolvedValue({});

            await reEvaluateQueue(HOSPITAL_ID, 'ICU');

            // Bed.findOneAndUpdate called exactly once (the break after orphan release
            // prevents the second iteration from claiming another bed).
            expect(Bed.findOneAndUpdate).toHaveBeenCalledTimes(1);
        });
    });

    // ── Already-admitted guard ────────────────────────────────────────────────
    //
    // A patient is in the queue but already has an active 'Admitted' record
    // (e.g., manually admitted while still in queue). The bed must be released,
    // the queue entry must be Cancelled, and the loop should continue (try next).

    describe('already-admitted guard', () => {
        it('releases the bed and cancels the queue entry when patient is already admitted', async () => {
            const bed        = makeBed('bed-001');
            const queueEntry = makeQueueEntry(PATIENT_ID_1);

            // countDocuments = 0 → maxIterations = 1 → loop runs exactly once, then exits.
            Bed.countDocuments.mockResolvedValue(0);
            Bed.findOneAndUpdate.mockResolvedValue(bed);
            WaitingQueue.findOneAndUpdate.mockResolvedValue(queueEntry);
            PatientAdmission.findOne.mockResolvedValue(makeExistingAdmission()); // already in
            Bed.findByIdAndUpdate.mockResolvedValue({});
            WaitingQueue.findByIdAndUpdate.mockResolvedValue({});

            const result = await reEvaluateQueue(HOSPITAL_ID, 'ICU');

            expect(result).toEqual({ allocatedCount: 0 });

            // Bed released
            expect(Bed.findByIdAndUpdate).toHaveBeenCalledWith(
                bed._id,
                { $set: { isOccupied: false } }
            );
            // Queue entry cancelled
            expect(WaitingQueue.findByIdAndUpdate).toHaveBeenCalledWith(
                queueEntry._id,
                { $set: { status: 'Cancelled', cancelledAt: expect.any(Date) } }
            );
            // No admission created
            expect(PatientAdmission.create).not.toHaveBeenCalled();
        });

        it('queries PatientAdmission with patientId and status: Admitted', async () => {
            const queueEntry = makeQueueEntry(PATIENT_ID_1);
            Bed.countDocuments.mockResolvedValue(0);
            Bed.findOneAndUpdate.mockResolvedValue(makeBed());
            WaitingQueue.findOneAndUpdate.mockResolvedValue(queueEntry);
            PatientAdmission.findOne.mockResolvedValue(makeExistingAdmission());
            Bed.findByIdAndUpdate.mockResolvedValue({});
            WaitingQueue.findByIdAndUpdate.mockResolvedValue({});

            await reEvaluateQueue(HOSPITAL_ID, 'ICU');

            expect(PatientAdmission.findOne).toHaveBeenCalledWith({
                patientId: PATIENT_ID_1,
                status: 'Admitted',
            });
        });
    });

    // ── Revert on PatientAdmission.create failure ─────────────────────────────
    //
    // If PatientAdmission.create throws (e.g. unique index violation, network
    // error), the service must undo both writes made before it:
    //   - Bed.findByIdAndUpdate → isOccupied: false
    //   - WaitingQueue.findByIdAndUpdate → status: 'Waiting', admittedAt: null
    // And must stop processing this department (break, not continue).

    describe('revert on PatientAdmission.create failure', () => {
        it('reverts bed and queue when create throws, then stops the department', async () => {
            const bed        = makeBed('bed-fail');
            const queueEntry = makeQueueEntry(PATIENT_ID_1);

            Bed.countDocuments.mockResolvedValue(1); // maxIterations = 2
            Bed.findOneAndUpdate.mockResolvedValue(bed);
            WaitingQueue.findOneAndUpdate.mockResolvedValue(queueEntry);
            PatientAdmission.findOne.mockResolvedValue(null); // not already admitted
            PatientAdmission.create.mockRejectedValue(new Error('duplicate key'));
            Bed.findByIdAndUpdate.mockResolvedValue({});
            WaitingQueue.findByIdAndUpdate.mockResolvedValue({});

            const result = await reEvaluateQueue(HOSPITAL_ID, 'ICU');

            expect(result).toEqual({ allocatedCount: 0 });

            // Bed must be released
            expect(Bed.findByIdAndUpdate).toHaveBeenCalledWith(
                bed._id,
                { $set: { isOccupied: false } }
            );
            // Queue entry must be reverted to Waiting
            expect(WaitingQueue.findByIdAndUpdate).toHaveBeenCalledWith(
                queueEntry._id,
                { $set: { status: 'Waiting', admittedAt: null } }
            );
        });

        it('stops processing after the first failure (break, not continue)', async () => {
            Bed.countDocuments.mockResolvedValue(2); // maxIterations = 3
            Bed.findOneAndUpdate.mockResolvedValue(makeBed());
            WaitingQueue.findOneAndUpdate.mockResolvedValue(makeQueueEntry());
            PatientAdmission.findOne.mockResolvedValue(null);
            PatientAdmission.create.mockRejectedValue(new Error('write failure'));
            Bed.findByIdAndUpdate.mockResolvedValue({});
            WaitingQueue.findByIdAndUpdate.mockResolvedValue({});

            await reEvaluateQueue(HOSPITAL_ID, 'ICU');

            // If the service broke correctly after failure, Bed.findOneAndUpdate
            // was called exactly once. A continue would call it again.
            expect(Bed.findOneAndUpdate).toHaveBeenCalledTimes(1);
        });
    });

    // ── Loop cap ──────────────────────────────────────────────────────────────
    //
    // If corrupted queue entries (all patients already admitted) keep triggering
    // the already-admitted guard, the loop must stop after (initialFreeBedCount + 1)
    // iterations regardless — preventing an infinite loop.

    describe('loop cap', () => {
        it('stops after initialFreeBedCount + 1 iterations on corrupt queue', async () => {
            // countDocuments = 2 → maxIterations = 3.
            // Every iteration: bed claimed, queue entry found, patient already admitted
            // → release bed, cancel entry, continue.
            // After 3 iterations (iterations === maxIterations), while condition is
            // false and the loop exits.
            Bed.countDocuments.mockResolvedValue(2);
            Bed.findOneAndUpdate.mockResolvedValue(makeBed());
            WaitingQueue.findOneAndUpdate.mockResolvedValue(makeQueueEntry());
            PatientAdmission.findOne.mockResolvedValue(makeExistingAdmission());
            Bed.findByIdAndUpdate.mockResolvedValue({});
            WaitingQueue.findByIdAndUpdate.mockResolvedValue({});

            const result = await reEvaluateQueue(HOSPITAL_ID, 'ICU');

            expect(result).toEqual({ allocatedCount: 0 });
            // Loop ran exactly maxIterations = 3 times.
            expect(Bed.findOneAndUpdate).toHaveBeenCalledTimes(3);
        });

        it('loop cap is computed per department, not globally', async () => {
            // When called with department = null, each of the 3 departments gets
            // its own countDocuments call and its own loop cap.
            Bed.countDocuments.mockResolvedValue(0); // maxIterations = 1 per dept
            Bed.findOneAndUpdate.mockResolvedValue(null); // no beds → break immediately

            await reEvaluateQueue(HOSPITAL_ID, null); // all departments

            // countDocuments should have been called once per department (3 total).
            expect(Bed.countDocuments).toHaveBeenCalledTimes(3);
        });
    });

    // ── Happy path ────────────────────────────────────────────────────────────
    //
    // One free bed, one waiting patient, no prior admission — full allocation.

    describe('happy path', () => {
        it('creates an admission and increments allocatedCount', async () => {
            const bed        = makeBed('bed-happy');
            const queueEntry = makeQueueEntry(PATIENT_ID_1, 90);

            Bed.countDocuments.mockResolvedValue(1);
            Bed.findOneAndUpdate
                .mockResolvedValueOnce(bed)   // first iteration: claim bed
                .mockResolvedValueOnce(null);  // second iteration: no more beds → break
            WaitingQueue.findOneAndUpdate.mockResolvedValue(queueEntry);
            PatientAdmission.findOne.mockResolvedValue(null); // not already admitted
            PatientAdmission.create.mockResolvedValue({});
            Patient.findById.mockResolvedValue(makePatient()); // for fire-and-forget SMS

            const result = await reEvaluateQueue(HOSPITAL_ID, 'ICU');

            expect(result).toEqual({ allocatedCount: 1 });
            expect(PatientAdmission.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    hospitalId:  HOSPITAL_ID,
                    patientId:   PATIENT_ID_1,
                    bedId:       bed._id,
                    department:  'ICU',
                    status:      'Admitted',
                    score:       queueEntry.score,
                })
            );
        });

        it('emits queuePatientAdmitted socket event to the correct hospital room', async () => {
            const bed        = makeBed();
            const queueEntry = makeQueueEntry(PATIENT_ID_1);

            Bed.countDocuments.mockResolvedValue(1);
            Bed.findOneAndUpdate
                .mockResolvedValueOnce(bed)
                .mockResolvedValueOnce(null);
            WaitingQueue.findOneAndUpdate.mockResolvedValue(queueEntry);
            PatientAdmission.findOne.mockResolvedValue(null);
            PatientAdmission.create.mockResolvedValue({});
            Patient.findById.mockResolvedValue(makePatient());

            await reEvaluateQueue(HOSPITAL_ID, 'General');

            expect(io.to).toHaveBeenCalledWith(`hospital_${HOSPITAL_ID}`);
        });

        it('allocates multiple patients when multiple free beds exist', async () => {
            Bed.countDocuments.mockResolvedValue(2); // maxIterations = 3
            Bed.findOneAndUpdate
                .mockResolvedValueOnce(makeBed('bed-1'))
                .mockResolvedValueOnce(makeBed('bed-2'))
                .mockResolvedValueOnce(null); // no more beds on 3rd iteration
            WaitingQueue.findOneAndUpdate
                .mockResolvedValueOnce(makeQueueEntry(PATIENT_ID_1, 90))
                .mockResolvedValueOnce(makeQueueEntry(PATIENT_ID_2, 70));
            PatientAdmission.findOne.mockResolvedValue(null);
            PatientAdmission.create.mockResolvedValue({});
            Patient.findById.mockResolvedValue(makePatient());

            const result = await reEvaluateQueue(HOSPITAL_ID, 'Emergency');

            expect(result).toEqual({ allocatedCount: 2 });
            expect(PatientAdmission.create).toHaveBeenCalledTimes(2);
        });
    });

    // ── Department scoping ────────────────────────────────────────────────────

    describe('department scoping', () => {
        it('only processes the specified department when one is given', async () => {
            Bed.countDocuments.mockResolvedValue(0);
            Bed.findOneAndUpdate.mockResolvedValue(null);

            await reEvaluateQueue(HOSPITAL_ID, 'ICU');

            // countDocuments and findOneAndUpdate should only be called for ICU, not
            // General or Emergency.
            expect(Bed.countDocuments).toHaveBeenCalledTimes(1);
            expect(Bed.countDocuments).toHaveBeenCalledWith(
                expect.objectContaining({ department: 'ICU' })
            );
        });

        it('processes all three departments when department is null', async () => {
            Bed.countDocuments.mockResolvedValue(0);
            Bed.findOneAndUpdate.mockResolvedValue(null);

            await reEvaluateQueue(HOSPITAL_ID, null);

            expect(Bed.countDocuments).toHaveBeenCalledTimes(3);
            const calledDepts = Bed.countDocuments.mock.calls.map(([q]) => q.department);
            expect(calledDepts).toEqual(expect.arrayContaining(['ICU', 'General', 'Emergency']));
        });
    });
});
