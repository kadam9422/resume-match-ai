from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import ROOT_DIR, settings
from .database import Base, engine, get_db
from .models import ResumeAnalysis, User
from .resume_service import ALLOWED_EXTENSIONS, MAX_FILE_SIZE, analyze_resume, extract_resume_text, store_resume
from .security import create_access_token, get_token_user_id, hash_password, verify_password

Base.metadata.create_all(bind=engine)
app = FastAPI(title="AI Resume Analyzer API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=ROOT_DIR / "uploads"), name="uploads")


def current_user_id(authorization: str | None) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    user_id = get_token_user_id(authorization.removeprefix("Bearer "))
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or expired token")
    return user_id


def user_response(user: User) -> dict:
    return {"id": user.id, "name": user.name, "email": user.email}


def analysis_response(analysis: ResumeAnalysis) -> dict:
    return {
        "_id": str(analysis.id),
        "fileName": analysis.file_name,
        "filePath": analysis.file_url,
        "role": analysis.role,
        "summary": analysis.summary,
        "skills": analysis.skills,
        "strengths": analysis.strengths,
        "improvements": analysis.improvements,
        "matchScore": analysis.match_score,
        "createdAt": analysis.created_at.isoformat() if analysis.created_at else None,
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "message": "AI Resume Analyzer API is running"}


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: dict, db: Session = Depends(get_db)):
    name = str(payload.get("name", "")).strip()
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    if not name or not email or len(password) < 8:
        raise HTTPException(status_code=400, detail="Name, valid email, and password (8+ characters) are required")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(name=name, email=email, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": create_access_token(user.id), "user": user_response(user)}


@app.post("/api/auth/login")
def login(payload: dict, db: Session = Depends(get_db)):
    email = str(payload.get("email", "")).strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(str(payload.get("password", "")), user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": create_access_token(user.id), "user": user_response(user)}


@app.get("/api/auth/me")
def me(authorization: str | None = None, db: Session = Depends(get_db)):
    user_id = current_user_id(authorization)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user_response(user)}


@app.post("/api/analysis/upload")
async def upload_resume(
    authorization: str | None = None,
    resume: UploadFile = File(...),
    role: str = Form("General professional role"),
    db: Session = Depends(get_db),
):
    user_id = current_user_id(authorization)
    filename = resume.filename or "resume"
    extension = filename[filename.rfind("."):].lower() if "." in filename else ""
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, and TXT resumes are supported")
    content = await resume.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Resume must be 5 MB or smaller")
    try:
        resume_text = extract_resume_text(filename, content)
        analysis = analyze_resume(resume_text, role.strip() or "General professional role")
        file_url = store_resume(filename, content)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail="Resume analysis or storage failed") from error

    record = ResumeAnalysis(
        user_id=user_id,
        file_name=filename,
        file_url=file_url,
        role=role.strip() or "General professional role",
        summary=analysis["summary"],
        skills=analysis["skills"],
        strengths=analysis["strengths"],
        improvements=analysis["improvements"],
        match_score=analysis["matchScore"],
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"success": True, "analysis": analysis, "fileName": filename, "filePath": file_url}


@app.get("/api/analysis/history")
def history(authorization: str | None = None, db: Session = Depends(get_db)):
    user_id = current_user_id(authorization)
    records = db.scalars(
        select(ResumeAnalysis)
        .where(ResumeAnalysis.user_id == user_id)
        .order_by(ResumeAnalysis.created_at.desc())
    ).all()
    return {"history": [analysis_response(record) for record in records]}