import { calculatePriority } from '../utils/bedAllotment.js';

// calculatePriority is a pure function — no mocks needed.
//
// Formula (from source):
//   ageScore       = 10 - floor(age / 10)   ← younger → higher
//   severityScore  = existingMedicalCondition ? 5 : 0
//   emergencyScore = department === 'Emergency' ? 10 : 0
//   icuScore       = department === 'ICU' ? 10 : 0
//   total          = ageScore + severityScore + emergencyScore + icuScore + adminScore

describe('calculatePriority', () => {
    // ── Age score ─────────────────────────────────────────────────────────────

    describe('age scoring', () => {
        it('gives maximum age score to a patient under 10', () => {
            const patient = { age: 5, department: 'General', existingMedicalCondition: false };
            // ageScore = 10 - floor(5/10) = 10 - 0 = 10
            expect(calculatePriority(patient, 0)).toBe(10);
        });

        it('gives lower age score to a patient in their 20s', () => {
            const patient = { age: 25, department: 'General', existingMedicalCondition: false };
            // ageScore = 10 - floor(25/10) = 10 - 2 = 8
            expect(calculatePriority(patient, 0)).toBe(8);
        });

        it('gives lowest age score to an elderly patient', () => {
            const patient = { age: 85, department: 'General', existingMedicalCondition: false };
            // ageScore = 10 - floor(85/10) = 10 - 8 = 2
            expect(calculatePriority(patient, 0)).toBe(2);
        });

        it('younger patient scores higher than older patient (all else equal)', () => {
            const base = { department: 'General', existingMedicalCondition: false };
            const young  = calculatePriority({ ...base, age: 10 }, 0); // ageScore = 9
            const older  = calculatePriority({ ...base, age: 40 }, 0); // ageScore = 6
            expect(young).toBeGreaterThan(older);
        });
    });

    // ── Severity score ────────────────────────────────────────────────────────

    describe('existing medical condition', () => {
        it('adds 5 points when patient has an existing medical condition', () => {
            const without = calculatePriority(
                { age: 30, department: 'General', existingMedicalCondition: false }, 0
            );
            const with_ = calculatePriority(
                { age: 30, department: 'General', existingMedicalCondition: true }, 0
            );
            expect(with_ - without).toBe(5);
        });

        it('adds no severity points when no existing condition', () => {
            const patient = { age: 30, department: 'General', existingMedicalCondition: false };
            // ageScore = 10 - 3 = 7, no other bonuses
            expect(calculatePriority(patient, 0)).toBe(7);
        });
    });

    // ── Department bonus ──────────────────────────────────────────────────────

    describe('department scoring', () => {
        const base = { age: 30, existingMedicalCondition: false }; // ageScore = 7

        it('adds 10 points for Emergency department', () => {
            expect(calculatePriority({ ...base, department: 'Emergency' }, 0)).toBe(17);
        });

        it('adds 10 points for ICU department', () => {
            expect(calculatePriority({ ...base, department: 'ICU' }, 0)).toBe(17);
        });

        it('adds no department bonus for General', () => {
            expect(calculatePriority({ ...base, department: 'General' }, 0)).toBe(7);
        });

        it('ICU and Emergency patients score higher than General (all else equal)', () => {
            const general   = calculatePriority({ ...base, department: 'General' }, 0);
            const icu       = calculatePriority({ ...base, department: 'ICU' }, 0);
            const emergency = calculatePriority({ ...base, department: 'Emergency' }, 0);
            expect(icu).toBeGreaterThan(general);
            expect(emergency).toBeGreaterThan(general);
        });
    });

    // ── Admin score contribution ──────────────────────────────────────────────

    describe('admin score', () => {
        it('higher admin score produces a higher total (monotonically)', () => {
            const patient = { age: 30, department: 'General', existingMedicalCondition: false };
            const low  = calculatePriority(patient, 1);
            const high = calculatePriority(patient, 5);
            expect(high).toBeGreaterThan(low);
            expect(high - low).toBe(4); // difference equals difference in admin scores
        });

        it('admin score of 0 contributes nothing extra', () => {
            const patient = { age: 30, department: 'General', existingMedicalCondition: false };
            // ageScore = 7, everything else 0
            expect(calculatePriority(patient, 0)).toBe(7);
        });
    });

    // ── Priority ordering (combined) ──────────────────────────────────────────

    describe('priority ordering', () => {
        it('ICU patient with condition outscores General patient without', () => {
            const critical = { age: 25, department: 'ICU', existingMedicalCondition: true };
            const routine  = { age: 25, department: 'General', existingMedicalCondition: false };
            expect(calculatePriority(critical, 3)).toBeGreaterThan(calculatePriority(routine, 3));
        });

        it('produces the correct total for a fully specified patient', () => {
            // age 25 → ageScore = 10-2 = 8
            // ICU → icuScore = 10
            // condition → severityScore = 5
            // adminScore = 3
            // total = 8 + 5 + 10 + 0 + 3 = 26
            const patient = { age: 25, department: 'ICU', existingMedicalCondition: true };
            expect(calculatePriority(patient, 3)).toBe(26);
        });
    });
});

// ── Phase 5: Weighted scoring ─────────────────────────────────────────────────
//
// DEFAULT_WEIGHTS (all 1.0) must produce identical results to pre-Phase-5.
// Non-unit weights scale each component independently.

import { DEFAULT_WEIGHTS } from '../utils/bedAllotment.js';

describe('calculatePriority — weighted scoring (Phase 5)', () => {
    const base = { age: 25, department: 'ICU', existingMedicalCondition: true };

    describe('DEFAULT_WEIGHTS regression', () => {
        it('produces identical score with explicit DEFAULT_WEIGHTS as with no weights arg', () => {
            const noWeights  = calculatePriority(base, 3);
            const defWeights = calculatePriority(base, 3, DEFAULT_WEIGHTS);
            expect(defWeights).toBe(noWeights);
        });

        it('all DEFAULT_WEIGHTS are 1.0', () => {
            expect(DEFAULT_WEIGHTS).toEqual({
                ageWeight:        1,
                severityWeight:   1,
                emergencyWeight:  1,
                icuWeight:        1,
                adminScoreWeight: 1,
            });
        });
    });

    describe('custom weights', () => {
        it('doubling icuWeight doubles the ICU component only', () => {
            const patient  = { age: 30, department: 'ICU', existingMedicalCondition: false };
            // ageScore = 7 * 1, icuScore = 10 * 1, adminScore = 0
            const baseScore   = calculatePriority(patient, 0);
            // ageScore = 7 * 1, icuScore = 10 * 2, adminScore = 0
            const weights2x   = { ...DEFAULT_WEIGHTS, icuWeight: 2 };
            const doubledScore = calculatePriority(patient, 0, weights2x);
            expect(doubledScore - baseScore).toBe(10); // extra 10 from doubled ICU component
        });

        it('zero ageWeight removes the age component entirely', () => {
            const young = { age: 5, department: 'General', existingMedicalCondition: false };
            const old_  = { age: 85, department: 'General', existingMedicalCondition: false };
            const noAge = { ...DEFAULT_WEIGHTS, ageWeight: 0 };
            expect(calculatePriority(young, 0, noAge)).toBe(calculatePriority(old_, 0, noAge));
        });

        it('adminScoreWeight scales admin score contribution', () => {
            const patient = { age: 30, department: 'General', existingMedicalCondition: false };
            const w2 = { ...DEFAULT_WEIGHTS, adminScoreWeight: 2 };
            const base_  = calculatePriority(patient, 3);          // adminScore = 3 * 1 = 3
            const scaled = calculatePriority(patient, 3, w2);      // adminScore = 3 * 2 = 6
            expect(scaled - base_).toBe(3); // +3 from the doubled admin score
        });

        it('severityWeight = 0 removes the medical condition bonus', () => {
            const withCondition    = { age: 30, department: 'General', existingMedicalCondition: true };
            const withoutCondition = { age: 30, department: 'General', existingMedicalCondition: false };
            const noSeverity = { ...DEFAULT_WEIGHTS, severityWeight: 0 };
            expect(calculatePriority(withCondition, 0, noSeverity))
                .toBe(calculatePriority(withoutCondition, 0, noSeverity));
        });

        it('produces correct total for a fully specified weighted patient', () => {
            // age 30 → ageScore = (10-3) * 1.5 = 10.5
            // ICU    → icuScore = 10 * 2 = 20
            // no condition → severityScore = 0
            // adminScore = 4 * 0.5 = 2
            // total = round(10.5 + 20 + 0 + 0 + 2) = 33 (via Math.round)
            const patient = { age: 30, department: 'ICU', existingMedicalCondition: false };
            const weights = { ageWeight: 1.5, severityWeight: 1, emergencyWeight: 1, icuWeight: 2, adminScoreWeight: 0.5 };
            expect(calculatePriority(patient, 4, weights)).toBe(33);
        });
    });
});
