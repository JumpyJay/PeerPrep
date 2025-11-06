This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Question Service Endpoints

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
