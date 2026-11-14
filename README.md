# AeroRoute-AI
Intelligent Drone Route Optimization Using Genetic Algorithms

## Run locally

Start the FastAPI backend from `backend`:

```powershell
cd backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

Start the React app from `frontend` in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend uses `http://127.0.0.1:8000` by default. Set `VITE_API_BASE_URL` before starting Vite to use another backend URL. Mission plans are stored in SQLite at the repository root; set `AEROROUTE_DB_PATH` to choose a different database file.

The fleet specifications and restricted airspace zones currently served by the backend are configured demonstration data. Live weather comes from Open-Meteo when reachable. Simulation and planning output is informational and does not control a physical aircraft or grant flight authorization.
