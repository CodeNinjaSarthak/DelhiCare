# DelhiCare — Hospital Triage & Bed Management System

> Built for **Smart India Hackathon — BU (Bennett University) Round**

DelhiCare is a full-stack hospital operations platform designed to reduce patient wait times and optimise bed utilisation through priority-based triage, real-time queue management, and an analytics dashboard — all in a single, deployable monolith.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [License](#license)

---

## Features

### Bed Management
- Real-time bed occupancy tracking across wards and departments
- Priority-based allocation using a configurable scoring engine (acuity, age, wait-time weights)
- Automated queue re-evaluation on every discharge or bed-status change
- Department-level queue tabs with cancel support

### Patient Lifecycle
- Streamlined admission via bed-allotment requests
- Discharge flow with automatic queue re-evaluation
- Full audit trail for every state transition (admit, discharge, queue changes)

### Analytics Dashboard
- Live metrics: occupancy rate, average wait time, queue depth, daily admissions
- Powered by 5 parallel MongoDB aggregations for low-latency reads
- Paginated admitted-patients and waiting-queue views

### Observability & Operations
- Structured JSON logging with correlation IDs per request
- `/api/v1/health` liveness endpoint
- Docker-ready; GitHub Actions CI pipeline included

### Security
- JWT-based authentication stored in HttpOnly cookies
- Hospital-scoped data isolation on every authenticated route

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js (ESM), Express.js |
| Database | MongoDB + Mongoose |
| Real-time | Socket.IO |
| Auth | JSON Web Tokens (HttpOnly cookies) |
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui |
| HTTP Client | Axios |
| Notifications | react-toastify |
| Testing | Jest + Babel (backend) |
| Infra | Docker, GitHub Actions |

---

## Architecture

```
DelhiCare/
├── backend/                  # Express API server
│   ├── controllers/          # Route handlers (hospital, stats, audit)
│   ├── services/             # Business logic (bed allocation, audit)
│   ├── models/               # Mongoose schemas
│   ├── middlewares/          # Auth, error handling, logging
│   └── utils/                # Priority calculator, paginator
└── frontend/                 # React + TypeScript SPA
    └── src/
        └── components/
            └── adminDashboard/
                └── bedAllotment/ # Core triage UI
```

Key design decisions:
- **Score immutability** — priority is calculated once at request time; queue re-evaluation reads the stored score directly.
- **Document-atomic operations** — no distributed transactions; concurrency safety via atomic Mongoose ops.
- **Audit writes are non-transactional** — failures are logged at WARN level and never surfaced to the client.

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- MongoDB ≥ 6
- npm

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in values (see below)
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Docker (full stack)

```bash
docker compose up --build
```

---

## Environment Variables

Create `backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/delhicare
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/hospital/register` | Register a hospital |
| POST | `/api/v1/hospital/login` | Login, sets HttpOnly cookie |

### Hospital
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/hospital/me` | Authenticated hospital profile |
| GET | `/api/v1/hospital/patients` | Paginated admitted patients |
| GET | `/api/v1/hospital/queue` | Paginated waiting queue |
| DELETE | `/api/v1/hospital/queue/:queueId` | Cancel a queue entry |
| GET | `/api/v1/hospital/policy` | Get scoring weights |
| PUT | `/api/v1/hospital/policy` | Update scoring weights |

### Analytics & Audit
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/dashboard/metrics` | Aggregated dashboard metrics |
| GET | `/api/v1/audit` | Paginated audit log |
| GET | `/api/v1/health` | Liveness check |

---

## Project Structure — Notable Files

```
backend/
  controllers/hospitalController.js   — register · login · discharge · queue · policy
  controllers/statsController.js      — dashboard metrics (5 parallel aggregations)
  controllers/auditController.js      — paginated audit log
  services/bedAllocationService.js    — atomic queue re-evaluation
  services/auditService.js            — non-transactional audit writes
  utils/bedAllotment.js               — calculatePriority · findBestBed
  utils/paginate.js                   — generic Mongoose paginator
  models/HospitalPolicyModel.js       — per-hospital weights + version counter
  models/AuditLogModel.js             — audit schema (4 indexes)

frontend/src/components/adminDashboard/bedAllotment/
  bedAllotment.tsx      — metrics dashboard
  AdmittedPatients.tsx  — discharge flow + audit panel
  AuditPanel.tsx        — Dialog-based timeline
  QueueTable.tsx        — department tabs + cancel
  QueuePage.tsx         — route wrapper
```

---

## License

MIT — see [LICENSE](./LICENSE)
