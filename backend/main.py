from __future__ import annotations

import io
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "all_job_post.csv"

app = FastAPI(title="Matchly Resume Intelligence API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SKILL_ALIASES = {
    "javascript": ["javascript", "js"], "typescript": ["typescript", "ts"],
    "react": ["react", "react.js", "reactjs"], "node.js": ["node.js", "nodejs", "node js"],
    "python": ["python", "pandas", "numpy", "django", "flask"],
    "sql": ["sql", "mysql", "postgresql", "postgres", "oracle"],
    "aws": ["aws", "amazon web services", "s3", "ec2"], "azure": ["azure"],
    "machine learning": ["machine learning", "ml", "scikit-learn", "tensorflow", "pytorch"],
    "data analysis": ["data analysis", "data analytics", "tableau", "power bi", "excel"],
    "project management": ["project management", "agile", "scrum", "jira"],
    "communication": ["communication", "presentation", "stakeholder"],
    "leadership": ["leadership", "mentoring", "team lead", "people management"],
    "recruiting": ["recruiting", "recruitment", "talent acquisition"],
    "payroll": ["payroll", "compensation", "benefits"],
    "compliance": ["compliance", "regulatory", "labor law"],
    "marketing": ["marketing", "seo", "content strategy", "campaign"],
    "sales": ["sales", "business development", "crm", "account management"],
}


def load_jobs() -> pd.DataFrame:
    if not CSV_PATH.exists():
        return pd.DataFrame(columns=["job_id", "category", "job_title", "job_description", "job_skill_set"])
    return pd.read_csv(CSV_PATH, encoding_errors="ignore", on_bad_lines="skip").fillna("")


JOBS = load_jobs()


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def profile(row: pd.Series, index: int) -> dict[str, Any]:
    title = clean(row.get("job_title")) or "Untitled role"
    category = clean(row.get("category")) or "General"
    skills = extract_skills(f"{row.get('job_skill_set', '')} {row.get('job_description', '')}")
    return {
        "id": str(row.get("job_id") or index), "title": title, "category": category,
        "label": f"{title} · {category}", "skills": skills,
        "summary": clean(row.get("job_description"))[:240],
    }


def extract_skills(text: str) -> list[str]:
    haystack = text.lower()
    found = []
    for canonical, aliases in SKILL_ALIASES.items():
        if any(re.search(r"(?<![a-z0-9])" + re.escape(alias) + r"(?![a-z0-9])", haystack) for alias in aliases):
            found.append(canonical)
    return found


def get_profile(job_id: str) -> pd.Series:
    if JOBS.empty:
        raise HTTPException(404, "Dataset is not available")
    matches = JOBS[JOBS["job_id"].astype(str) == str(job_id)]
    if matches.empty:
        matches = JOBS.iloc[[0]]
    return matches.iloc[0]


def extract_resume_text(filename: str, data: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        try:
            import fitz
            return "\n".join(page.get_text() for page in fitz.open(stream=data, filetype="pdf"))
        except Exception as exc:
            raise HTTPException(400, f"Could not read this PDF: {exc}")
    if suffix == ".docx":
        try:
            from docx import Document
            return "\n".join(p.text for p in Document(io.BytesIO(data)).paragraphs)
        except Exception as exc:
            raise HTTPException(400, f"Could not read this DOCX: {exc}")
    try:
        return data.decode("utf-8", errors="ignore")
    except Exception as exc:
        raise HTTPException(400, f"Could not read this file: {exc}")


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "dataset_rows": len(JOBS)}


@app.get("/api/profiles")
def profiles(q: str = "", limit: int = 30) -> dict[str, Any]:
    if JOBS.empty:
        return {"profiles": [], "total": 0}
    query = q.lower().strip()
    rows = JOBS
    if query:
        mask = rows.apply(lambda r: query in f"{r.get('job_title', '')} {r.get('category', '')}".lower(), axis=1)
        rows = rows[mask]
    seen, output = set(), []
    for index, row in rows.head(250).iterrows():
        item = profile(row, int(index))
        key = (item["title"].lower(), item["category"].lower())
        if key not in seen:
            seen.add(key)
            output.append(item)
        if len(output) >= limit:
            break
    return {"profiles": output, "total": len(output)}


@app.post("/api/analyze")
async def analyze(resume: UploadFile = File(...), job_id: str = "") -> dict[str, Any]:
    data = await resume.read()
    text = extract_resume_text(resume.filename or "resume.txt", data)
    if len(text.strip()) < 40:
        raise HTTPException(400, "The resume text is too short to analyze. Please upload a fuller resume.")
    job = get_profile(job_id)
    resume_skills = extract_skills(text)
    job_skills = extract_skills(f"{job.get('job_skill_set', '')} {job.get('job_description', '')}")
    if not job_skills:
        job_skills = extract_skills(f"{job.get('job_title', '')} {job.get('category', '')}")
    matched = [skill for skill in job_skills if skill in resume_skills]
    missing = [skill for skill in job_skills if skill not in resume_skills]
    score = round((len(matched) / len(job_skills)) * 100) if job_skills else 0
    title = clean(job.get("job_title")) or "Target role"
    verdict = "Strong match" if score >= 75 else "Promising match" if score >= 50 else "Needs development"
    recommendations = [f"Add evidence of {skill} through a project, certification, or measurable result." for skill in missing[:4]]
    if not recommendations:
        recommendations = ["Tailor your summary to mirror the role language.", "Add quantified outcomes to your strongest experience bullets."]
    return {
        "file_name": resume.filename, "profile": profile(job, 0), "score": score, "verdict": verdict,
        "matched": matched, "missing": missing, "recommendations": recommendations,
        "resume_word_count": len(re.findall(r"\b\w+\b", text)),
        "disclaimer": "This is a skills-based estimate from the supplied job posting, not a hiring decision.",
    }

