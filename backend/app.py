import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

ROOT = Path(__file__).parents[1]
sys.path.append(str(ROOT))
from ml.career_model import predict
from ml.recommender import recommend

DATA = json.loads((ROOT / "data" / "careers.json").read_text(encoding="utf-8"))
CAREERS = {c["name"]: c for c in DATA["careers"]}
SKILLS, TRAITS = DATA["skills"], DATA["traits"]
LEVELS = ["Never used", "Basics", "Comfortable", "Can teach"]
BUDGET = {"Free only": ["Free"], "Low": ["Free", "Low"], "Medium": ["Free", "Low", "Medium"], "High": ["Free", "Low", "Medium"]}
YOUTUBE = "https://www.youtube.com/results?sp=EgIQAw%253D%253D&search_query="
load_dotenv(Path(__file__).parent / ".env")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
ADVICE_KEYS = ["skills", "tips", "youtube_channels", "free_courses", "paid_courses"]

app = FastAPI()


def call(url, body=None, headers={}, timeout=60):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data, {"Content-Type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.load(res)


def candidates(skill):
    q = urllib.parse.quote_plus(skill)
    return [
        SKILLS[skill]["resource"],
        {"title": "YouTube playlists", "url": YOUTUBE + q, "format": "Video", "level": "Beginner", "length": "Short", "cost": "Free"},
        {"title": "Practice exercises", "url": "https://www.google.com/search?q=" + q + "+practice+exercises",
         "format": "Hands-on", "level": "Beginner", "length": "Short", "cost": "Free"},
        {"title": "Udemy courses", "url": "https://www.udemy.com/courses/search/?q=" + q,
         "format": "Course", "level": "Beginner", "length": "Long", "cost": "Low"},
        {"title": "Coursera courses", "url": "https://www.coursera.org/search?query=" + q,
         "format": "Course", "level": "Intermediate", "length": "Long", "cost": "Medium"},
    ]


@app.get("/api/questions")
def questions():
    careers = [{"name": c["name"], "skills": c["skills"]} for c in CAREERS.values()]
    return {"questions": DATA["questions"], "careers": careers}


@app.post("/api/suggest")
def suggest(body: dict):
    result = []
    for r in predict(body["areas"], body["traits"]):
        c = CAREERS[r["career"]]
        liked = [TRAITS[t].lower() for t in c["traits"] if t in body["traits"]]
        why = [f"You are curious about {c['area']}."] if c["area"] in body["areas"] else []
        why += ["You enjoy " + ", ".join(liked) + "."] if liked else []
        result.append({**r, "area": c["area"], "why": why or ["Closest match to your answers."]})
    return result


@app.post("/api/plan")
def plan(body: dict):
    c = CAREERS[body["career"]]
    levels = {s: body["levels"].get(s, 0) for s in c["skills"]}
    todo = [s for s in c["skills"] if levels[s] < 2]

    hours, tasks, later = body["hours"] * 26, [], []
    for s in todo:
        cost = 40 if levels[s] == 0 else 20
        if cost <= hours:
            tasks.append(("Learn " if levels[s] == 0 else "Practise ") + s)
            hours -= cost
        else:
            later.append(s)
    tasks += ["Project: " + p for p in c["projects"][:2]]
    tasks += ["Certification preparation", "Portfolio and job applications"]
    months = [tasks[round(i * len(tasks) / 6):round((i + 1) * len(tasks) / 6)] for i in range(6)]

    udemy = "https://www.udemy.com/courses/search/?q=" + urllib.parse.quote_plus(c["name"])
    courses = c["courses"] + [{"title": "Udemy courses (search)", "url": udemy, "cost": "Low"}]
    return {
        "career": c["name"],
        "area": c["area"],
        "levels": [{"skill": s, "level": LEVELS[v], "ready": v >= 2} for s, v in levels.items()],
        "known": [s for s in c["skills"] if levels[s] >= 2],
        "priority": todo[:3],
        "roadmap": [m or ["Practice and revision"] for m in months],
        "later": later,
        "resources": [
            {"skill": s, "items": recommend([r for r in candidates(s) if r["cost"] in BUDGET[body["budget"]]],
                                            body["style"], levels[s], body["hours"])}
            for s in todo or c["skills"]
        ],
        "courses": [x for x in courses if x["cost"] in BUDGET[body["budget"]]],
        "certifications": [x for x in c["certifications"] if x["free"] or body["budget"] in ("Medium", "High")],
        "projects": c["projects"],
        "professional": c["professional"],
    }


@app.post("/api/analyze-jd")
def analyze_jd(body: dict):
    text = body["text"].lower()
    found = [s for s, v in SKILLS.items() if any(re.search(rf"\b{re.escape(k)}\b", text) for k in v["keywords"])]
    return {
        "required": found,
        "matching": [s for s in found if s in body["skills"]],
        "missing": [s for s in found if s not in body["skills"]],
    }


def serp(engine, **params):
    key = os.getenv("SERPAPI_KEY")
    if not key:
        return {}
    try:
        return call("https://serpapi.com/search?" + urllib.parse.urlencode({"engine": engine, "api_key": key, **params}), timeout=30)
    except Exception:
        return {}


@app.get("/api/advice")
def advice(career: str, location: str = "India"):
    web = serp("google", q=f"{career} skills required and how to get hired", location=location, hl="en").get("organic_results", [])[:6]
    videos = serp("youtube", search_query=f"{career} full course for beginners").get("video_results", [])[:4]
    context = "\n".join(f"- {r['title']}: {r.get('snippet', '')}" for r in web)
    prompt = (
        f"You are a career mentor. For a beginner in {location} who wants to become a {career}, give: "
        "skills employers ask for most, tips on how people usually land their first job, "
        "popular YouTube channels, well-known free courses and well-known paid courses. "
        "Use short names only, no links, 3 to 6 items each."
        + (f"\nBase your answer on these Google search results:\n{context}" if web else "")
    )
    schema = {
        "type": "object",
        "properties": {k: {"type": "array", "items": {"type": "string"}} for k in ADVICE_KEYS},
        "required": ADVICE_KEYS,
    }
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "responseSchema": schema},
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    try:
        res = call(url, body, {"x-goog-api-key": os.getenv("GEMINI_API_KEY", "")})
        answer, model = json.loads(res["candidates"][0]["content"]["parts"][0]["text"]), GEMINI_MODEL
    except Exception:
        try:
            local = {"model": OLLAMA_MODEL, "prompt": prompt, "format": schema, "stream": False}
            res = call(OLLAMA_URL + "/api/generate", local, timeout=180)
            answer, model = json.loads(res["response"]), OLLAMA_MODEL + " (Ollama)"
        except Exception:
            return {"available": False}
    return {
        "available": True,
        "model": model,
        **answer,
        "sources": [{"title": r["title"], "url": r["link"]} for r in web],
        "videos": [{"title": v["title"], "url": v["link"]} for v in videos],
    }


@app.get("/api/jobs")
def jobs(career: str, location: str):
    # Quoting keeps Google Jobs from matching single words ("Machine" -> machine operators)
    found = serp("google_jobs", q=f'"{career}"', location=location).get("jobs_results", [])
    if len(found) < 3:
        found = serp("google_jobs", q=career, location=location).get("jobs_results", [])
    found = found[:6]
    return {
        "available": bool(found),
        "jobs": [{
            "title": f"{j['title']} - {j.get('company_name', '')}, {j.get('location', '')}",
            "salary": j.get("detected_extensions", {}).get("salary"),
            "url": (j.get("apply_options") or [{}])[0].get("link") or j.get("share_link"),
        } for j in found],
    }
