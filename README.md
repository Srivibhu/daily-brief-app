# Daily Brief — Deploy to Vercel

## 1. Deploy to Vercel

Push to GitHub and import the repo in Vercel (or run `vercel` from this directory).

## 2. Database (Vercel Postgres via Neon)

1. Vercel dashboard → your project → **Storage** → **Create Database** → **Neon (Postgres)** → link to project
2. Open the database's **Query** tab, paste `supabase-schema.sql`, and run it
3. Add `JWT_SECRET` (`openssl rand -base64 32`) and optionally `NEXT_PUBLIC_APP_URL` under Settings → Environment Variables, then redeploy

## 3. First login

Visit your Vercel URL → click **Register** → create a username + password. After that, the httpOnly cookie keeps you logged in for 30 days — no re-entry needed.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your values
npm run dev                   # http://localhost:3000
```

## Features

- **Task cards** — playing-card grid layout (left-to-right rows), colored by priority/urgency
- **Card detail** — click any card to expand: progress slider, due date+time, priority, tags, link, notes
- **Tag editor** — create/delete tags, pick from 10 preset colors (🏷 button in header)
- **Done section** — completed tasks auto-move below a collapsible "Done" section
- **Pomodoro timer** — 25/5/15 min modes; absolute-timestamp drift correction; chime on complete
- **Focus tracking** — session log with delete; manual minute logger; 28-day activity heatmap
- **Analytics** — week-over-week tasks scheduled vs completed with % change; focus time stats
- **Reminders** — browser notifications: overdue, due in 1 day, 5 hours, 1 hour (requires permission)
- **Auth** — username + password, 30-day httpOnly cookie session

## Stack

Next.js 14 · Vercel Postgres · bcryptjs · jsonwebtoken · Vercel
