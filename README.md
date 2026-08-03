# Seat Planner V3 — The Squad Rotation

Simple seat rotation planner for 5 people across 5 seats.

**5! = 120 permutations**, scored and ranked in the browser. No backend needed.

## People

Priyangshu · Aryavrat · Yatharth · Sachin · Gaurav

## How It Works

1. Click **Generate** → evaluates all 120 possible arrangements
2. Scores each against your history (avoids same-seat-as-yesterday, maximizes pair diversity)
3. Click **Confirm** to save, or **Re-roll** for another option
4. Use **Manual** to set a custom arrangement
5. History persists in localStorage

## Tech Stack

- Vite + React (client-side only)
- All 120 permutations computed in-browser
- No backend, no database, no API

## Development

```bash
npm install
npm run dev
```
