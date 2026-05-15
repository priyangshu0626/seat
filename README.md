# Seat Planner V3 — Industrial-Grade Optimization Engine

This is a production-ready seating optimization engine designed to perfectly balance rotation fairness and pair diversity over long-horizon cycles.

It utilizes a hybrid architecture:
1. **Google OR-Tools CP-SAT (when available)** or pure-Python constraint logic to enforce hard constraints (e.g. perfect seat rotation, no immediate adjacent pairs).
2. **Multi-objective Scoring Engine** to maximize pair diversity, entropy, and minimize back-to-back repetitions.
3. **Monte Carlo Lookahead with Beam Search** to ensure today's schedule won't lead to dead-ends in future days.
4. **Gemini 2.5 Pro Advisory Layer** (Optional) to generate human-readable explanations of the math.

## 🚀 Hosting Online (Deployment Guide)

The application is built with **FastAPI** serving both the API and the static frontend from the `/frontend` directory. It is completely stateless, meaning you do not need a database like PostgreSQL or Redis.

It is easily hostable on platforms like **Render**, **Railway**, **Heroku**, or any Docker-compatible environment.

### Option 1: Deploying to Render (Recommended)

Render is the easiest way to deploy this since it supports Docker containers and standard Python environments out-of-the-box.

1. **Push this code to a GitHub repository.**
2. **Create a new Web Service on Render:**
   - Go to [Render Dashboard](https://dashboard.render.com/) -> New -> Web Service.
   - Connect your GitHub repository.
3. **Configure the Web Service:**
   - **Name:** `seat-planner` (or your choice)
   - **Environment:** `Docker` (Render will automatically detect the `Dockerfile`).
   - **Branch:** `main`
4. **Environment Variables (Advanced):**
   - Click "Advanced" and add the following Environment Variable:
   - `GEMINI_API_KEY`: (Optional) Add your Google Gemini API key if you want the AI advisory layer to generate natural language explanations for the seating arrangements.
5. **Deploy:** Click **Create Web Service**. Render will automatically build the Docker image and deploy it. It will inject the correct `$PORT` variable which the Dockerfile handles automatically.

### Option 2: Deploying to Railway

1. **Push to GitHub.**
2. Go to [Railway.app](https://railway.app/), click **New Project** -> **Deploy from GitHub repo**.
3. Railway will automatically detect the `Dockerfile` and build the project.
4. Go to the project **Variables** and add `GEMINI_API_KEY` (Optional).
5. Go to the **Settings** tab and click **Generate Domain** under the Environments section to get a public URL.

### Option 3: Deploying via standard Python Environment (No Docker)

If you're deploying on a platform that uses standard Python buildpacks (like Heroku) instead of Docker:

1. The platform will automatically install dependencies from `requirements.txt`.
2. Set the start command (Procfile or custom start command) to:
   ```bash
   uvicorn api:app --host 0.0.0.0 --port $PORT
   ```
3. Ensure the environment variable `PORT` is provided by the platform.

## ⚙️ How it Works

The frontend (`frontend/index.html` & `app.js`) is a static single-page application.
When you click "Generate", it sends the **entire history state** (pair interaction counts, total seat duty counts) to the backend API (`/generate`).

The API evaluates billions of potential seating combinations, applying hard constraints (like ensuring people aren't sitting in the exact same seat as yesterday), then scores the remaining valid options based on fairness metrics. It then simulates several days into the future to ensure the choice it makes today doesn't force a bad layout tomorrow.

Because the API receives the full state in every request, the backend is 100% stateless. This guarantees consistent deterministic results and means the server requires virtually zero memory to scale.
