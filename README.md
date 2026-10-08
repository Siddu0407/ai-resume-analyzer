# matchly — AI Resume Analyzer

Matchly compares an uploaded resume with job requirements extracted from `all_job_post.csv`, then returns a fit score, matched skills, missing skills, and practical next steps.

## Run locally

### API (Windows)
```powershell
cd "C:\Users\gadha\OneDrive\Desktop\ML glob"
.python\python.exe -m pip install -r backend\requirements.txt
.python\python.exe -m uvicorn backend.main:app --reload --port 8000
```

### Frontend
In a second terminal:
```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

The frontend dependencies are installed with:
```powershell
cd frontend
npm install
npm run dev
```

The supplied CSV has role postings but no company-name field, so the app labels its searchable targets as dataset-derived role profiles. The scoring engine is deliberately transparent and skill-based rather than pretending to make a hiring decision.
