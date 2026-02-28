export const DEFAULT_WEIGHTS = {
    ageWeight:        1,
    severityWeight:   1,
    emergencyWeight:  1,
    icuWeight:        1,
    adminScoreWeight: 1,
};

export const calculatePriority = (patient, score, weights = DEFAULT_WEIGHTS) => {
    const ageScore       = (10 - Math.floor(patient.age / 10)) * weights.ageWeight;
    const severityScore  = (patient.existingMedicalCondition ? 5 : 0) * weights.severityWeight;
    const emergencyScore = (patient.department === 'Emergency' ? 10 : 0) * weights.emergencyWeight;
    const icuScore       = (patient.department === 'ICU' ? 10 : 0) * weights.icuWeight;
    const adminScore     = score * weights.adminScoreWeight;
    return Math.round(ageScore + severityScore + emergencyScore + icuScore + adminScore);
};

// Function to get the best available bed
export const findBestBed = (patient, beds) => {
    const suitableBeds = beds.filter(bed => {
        if (bed.isOccupied) return false;
        if (patient.department === 'ICU' && bed.department !== 'ICU') return false;
        if (patient.department === 'Emergency' && bed.department !== 'Emergency') return false;
        if (patient.department === 'General' && bed.department !== 'General') return false;
        return true;
    });

    if (suitableBeds.length === 0) return null;

    // Sort by bed ID or other criteria if needed
    suitableBeds.sort((a, b) => a._id.toString().localeCompare(b._id.toString()));
    return suitableBeds[0];
};