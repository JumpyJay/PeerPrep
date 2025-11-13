# Welcome to PeerPrep 
PeerPrep is a free platform to prepare for technical interviews
for students, by students. It's a collaborative coding platform developed by G33 for CS3219 Software Engineering Principles and Patterns. 

## Features 

PeerPrep has 4 main microservices: User, Question, Matching and Collaboration Service. Each service communicates via Next.js API routes and shares a PostgreSQL instance with service-specific schemas.

Features of PeerPrep include:
- Authentication - secure user login using JWT and bcrypt.
- User Matching - pairs users based on question difficulty and topic selection. 
- Question Management - retrieve coding problems by difficulty. 
- Collaboration Room - real-time shared code editor powered by Socket.io and Quill.
- Persistent Data - stored in PostgreSQL, ensuring ACID compliance.

## Nice-to-have Features

G33 has decided to take a deep dive into a single category for the N2H features. The category chosen is N1 Service Enhancements.

N2H features include:

- Code Translation - AI-powered code translation across TypeScript, JavaScript, Python, Java and C++.
- Text Chat Integration - synchronized in-room chat for paired users.
- Ranking System - elo-style scoring based on problem difficulty.
- Attempt History - records user sessions and submissions.

## Deployment link
Access the app via the deployment links for the [web app](https://peerprepapp-483559310335.asia-east1.run.app/user) and the 
[websocket server](https://peerprepserver-483559310335.asia-east1.run.app).

## Running locally 

First, run the command below to obtain a local copy of the repo.
```bash
git clone https://github.com/JumpyJay/PeerPrep.git
```
Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Next, access [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Tech Stack

| Category | Technologies |
|-----------|---------------|
| **Frontend** | Next.js 15 (React), Tailwind CSS |
| **Backend** | TypeScript (Node.js), Next.js API Routes |
| **Database** | PostgreSQL (Cloud SQL on GCP) |
| **Collaboration** | Socket.io, Quill, Monaco Editor |
| **Authentication** | JWT, bcrypt |
| **DevOps** | Docker, Google Cloud Run, GitHub Actions (CI/CD) |
| **Utilities** | ESLint, Turbopack |

## Documentation: Matching Algorithm Design

1. **Enqueue:**  
   A user creates a ticket with `(difficulty, topics[], strict_mode)`.

2. **Try Match:**
   - **Strict Pass:**  
     - Same difficulty  
     - Topic subset match (e.g. `[tree]` ↔ `[array, tree]`)  
     - FIFO order (oldest first)
   - **Flexible Pass:**  
     - Same difficulty  
     - Topics may differ

3. **Atomic Update:**  
   Both tickets are atomically set to `MATCHED` using database transaction locks.

4. **Edge Cases Handled:**
   - Self-matching prevented (same user / ticket)
   - Handles `NULL` or empty topics gracefully
   - Prevents duplicate pairing with DB transaction locks
   - Strict-mode users only match with compatible strict-mode tickets
   - Expired or timed-out tickets cleaned automatically

## Documentation: Question Service Endpoints

- `GET /api/v1/question` — List all questions.
- `GET /api/v1/question/[id]` — Get question by id.
- `GET /api/v1/question/[id]/solution` — Get reference solution for a question.
- `GET /api/v1/question/select?difficulty=Easy&tags=Array,Hash%20Table&user=user@example.com&windowDays=7` — Select a suitable question by criteria, avoiding repeats within a window (default 7 days).

Environment variables:
- `QUESTION_REPEAT_WINDOW_DAYS` — default repeat-avoid window (days), default `7`.
- Cloud SQL connection vars: `INSTANCE_CONNECTION_NAME`, `DB_USER`, `DB_PASS`, `DB_NAME`, and `GOOGLE_APPLICATION_CREDENTIALS` (path to service account JSON).

PostgreSQL tables expected:

```sql
-- questions (simplified)
-- question_id SERIAL PRIMARY KEY
-- question_title TEXT NOT NULL
-- question_body TEXT NOT NULL
-- difficulty TEXT CHECK (difficulty IN ('Easy','Medium','Hard')) NOT NULL
-- tags TEXT[] NOT NULL
-- code_solution TEXT NOT NULL

-- track served history to avoid repeats
CREATE TABLE IF NOT EXISTS question_served (
  user_id TEXT NOT NULL,
  question_id INT NOT NULL,
  served_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_question_served_user_time ON question_served (user_id, served_at DESC);
```

## Documentation: Ranking System

An **Elo-style ranking system** rewards users based on their coding activity and question difficulty.

| Difficulty | Points |
|-------------|---------|
| Easy | +1 |
| Medium | +2 |
| Hard | +3 |

**Rank Tiers:**
- **Bronze**: 0–49  
- **Silver**: 50–99  
- **Gold**: 100–199  
- **Platinum**: 200–299  
- **Diamond**: 300+

Rankings are updated manually via a “Refresh Leaderboard” feature, which updates the `user_ranking` table in the database based on submission records.

## DevOps and Logging

- **Containerization:** All services built with Docker  
- **Deployment:** Hosted on Google Cloud Run  
- **CI/CD:** Automated via GitHub Actions 
- **Zero Downtime:** Rolling updates for seamless deployment  
- **Logging:** Centralized with Google Cloud Logging
- **Security:**  
  - CORS restrictions to only allow PeerPrep client origin  
  - Cloud Service Accounts manage access to Cloud SQL and Secret Manager  
  - Environment variables stored securely in container configs  
