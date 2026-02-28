/**
 * Seed script — populate the database with minimal test data.
 *
 * Usage:
 *   node scripts/seed.js            # add seed data (skips if hospital exists)
 *   node scripts/seed.js --reset    # wipe seed collections first, then re-seed
 *
 * Requires MONGO_URL to be set (via .env or environment).
 */

// Load .env relative to the backend directory so the script works regardless
// of which directory it is invoked from.
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Hospital } from '../models/hospitalModel.js';
import { Bed }      from '../models/bedModel.js';
import { Patient }  from '../models/patientModel.js';

const RESET = process.argv.includes('--reset');

// ── Data ──────────────────────────────────────────────────────────────────────

const HOSPITAL = {
    name:               'AIIMS Delhi',
    registrationNumber: 'DL-AIIMS-001',
    email:              'admin@aiims-delhi.example.com',
    password:           'Hospital@123',         // hashed below
    contactNumber:      '9999900001',
    totalBeds:          3,
    address: {
        street:   'Ansari Nagar East',
        locality: 'South Campus',
        city:     'Delhi',
        pinCode:  '110029',
    },
    // GeoJSON [longitude, latitude] — AIIMS Delhi
    location: { type: 'Point', coordinates: [77.2090, 28.5672] },
};

const BEDS = [
    { department: 'ICU',       isOccupied: false },
    { department: 'General',   isOccupied: false },
    { department: 'Emergency', isOccupied: false },
];

const PATIENT = {
    name:                    'Rahul Sharma',
    age:                     35,
    gender:                  'Male',
    contactNumber:           '9999900002',
    department:              'General',
    reasonForAdmission:      'Persistent fever and fatigue',
    existingMedicalCondition: 'Diabetes Type 2',
    address: {
        street:   'Sector 10',
        locality: 'Dwarka',
        city:     'Delhi',
        pinCode:  '110075',
    },
    latitude:  28.5921,
    longitude: 77.0266,
    emergencyContact: {
        name:          'Priya Sharma',
        contactNumber: '9999900003',
    },
};

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
    const url = process.env.MONGO_URL;
    if (!url) {
        console.error('[seed] MONGO_URL is not set. Add it to backend/.env');
        process.exit(1);
    }

    await mongoose.connect(url);
    console.log('[seed] Connected to', url);

    if (RESET) {
        console.log('[seed] --reset: clearing existing data…');
        await Promise.all([
            Hospital.deleteMany({}),
            Bed.deleteMany({}),
            Patient.deleteMany({}),
        ]);
        console.log('[seed] Cleared: hospitals, beds, patients');
    }

    // Idempotent guard — skip if seed hospital already exists.
    const existing = await Hospital.findOne({ registrationNumber: HOSPITAL.registrationNumber });
    if (existing && !RESET) {
        console.log('[seed] Seed data already present. Run with --reset to re-seed.');
        await mongoose.disconnect();
        return;
    }

    // Hospital
    const hospital = await Hospital.create({
        ...HOSPITAL,
        password: await bcrypt.hash(HOSPITAL.password, 10),
    });
    console.log(`[seed] Hospital created: ${hospital.name} (${hospital._id})`);
    console.log(`       Login: ${HOSPITAL.email} / ${HOSPITAL.password}`);

    // Beds
    await Bed.insertMany(BEDS.map((b) => ({ ...b, hospitalId: hospital._id })));
    console.log(`[seed] ${BEDS.length} beds created (ICU, General, Emergency)`);

    // Patient
    const patient = await Patient.create(PATIENT);
    console.log(`[seed] Patient created: ${patient.name} (${patient._id})`);

    console.log('\n[seed] Done. Run the app and use the hospital credentials above to log in.');
    await mongoose.disconnect();
}

seed().catch((err) => {
    console.error('[seed] Error:', err.message);
    process.exit(1);
});
