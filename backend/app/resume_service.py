import json
from io import BytesIO
from pathlib import Path

from docx import Document
from openai import OpenAI
import fitz

from .config import ROOT_DIR, settings

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 5 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


def extract_resume_text(filename: str, content: bytes) -> str:
    extension = Path(filename).suffix.lower()
    if extension == ".pdf":
        with fitz.open(stream=content, filetype="pdf") as document:
            text = "\n".join(page.get_text() for page in document)
    elif extension == ".docx":
        document = Document(BytesIO(content))
        text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    elif extension == ".txt":
        text = content.decode("utf-8", errors="replace")
    else:
        raise ValueError("Only PDF, DOCX, and TXT resumes are supported")

    if not text.strip():
        raise ValueError("No readable text was found in this resume")
    return text


def analyze_resume(text: str, role: str) -> dict:
    if settings.openai_api_key:
        client = OpenAI(api_key=settings.openai_api_key)
        response = client.chat.completions.create(
            model=settings.openai_model,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Analyze resumes against the target role. Return JSON with string summary, "
                        "string arrays skills, strengths, improvements, and integer matchScore from 0 to 100."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Target role: {role}\nResume text:\n{text[:12000]}",
                },
            ],
        )
        result = json.loads(response.choices[0].message.content or "{}")
        return _validate_analysis(result)

    lower_text = text.lower()
    common_skills = [
        "python", "javascript", "sql", "communication", "leadership",
        "project management", "data analysis", "problem solving",
    ]
    skills = [skill.title() for skill in common_skills if skill in lower_text]
    return {
        "summary": f"Resume reviewed for the {role} role. Add an OpenAI API key for tailored AI feedback.",
        "skills": skills or ["Add a skills section for stronger analysis"],
        "strengths": ["Resume text was extracted successfully"],
        "improvements": [
            "Add measurable outcomes to key achievements",
            "Tailor the experience section to the target role",
        ],
        "matchScore": min(95, 60 + len(skills) * 5),
    }


def _validate_analysis(result: dict) -> dict:
    return {
        "summary": str(result.get("summary", "Analysis complete.")),
        "skills": _string_list(result.get("skills")),
        "strengths": _string_list(result.get("strengths")),
        "improvements": _string_list(result.get("improvements")),
        "matchScore": max(0, min(100, int(result.get("matchScore", 0)))),
    }


def _string_list(value) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value[:20]]


def store_resume(filename: str, content: bytes) -> str:
    if all((settings.cloudinary_cloud_name, settings.cloudinary_api_key, settings.cloudinary_api_secret)):
        import cloudinary
        import cloudinary.uploader

        cloudinary.config(
            cloud_name=settings.cloudinary_cloud_name,
            api_key=settings.cloudinary_api_key,
            api_secret=settings.cloudinary_api_secret,
            secure=True,
        )
        result = cloudinary.uploader.upload(
            BytesIO(content),
            resource_type="raw",
            folder="resume-analyzer",
            use_filename=False,
            public_id=Path(filename).stem,
        )
        return result["secure_url"]

    safe_name = Path(filename).name.replace(" ", "-")
    stored_name = f"{__import__('uuid').uuid4().hex}-{safe_name}"
    (UPLOAD_DIR / stored_name).write_bytes(content)
    return f"/uploads/{stored_name}"