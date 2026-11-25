import argparse
import io
import json
import os
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types
import psycopg2
from pydantic import BaseModel, Field
from pypdf import PdfReader, PdfWriter


WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(WORKSPACE_ROOT / ".env.local")
load_dotenv(WORKSPACE_ROOT / ".env")


class ExtractedMcq(BaseModel):
    question_id: str | None = None
    question_number: int | None = None
    paper: str
    unit_number: int
    unit_name: str
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: str


class ExtractionBatch(BaseModel):
    questions: list[ExtractedMcq] = Field(default_factory=list)


MONTHS = {
    "jan": ("January", 1), "feb": ("February", 2), "mar": ("March", 3),
    "apr": ("April", 4), "may": ("May", 5), "jun": ("June", 6),
    "jul": ("July", 7), "aug": ("August", 8), "sep": ("September", 9),
    "oct": ("October", 10), "nov": ("November", 11), "dec": ("December", 12),
}


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def parse_filename(path: Path) -> tuple[int, str]:
    match = re.match(
        r"^(\d{4})_(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:_s([1-9]\d*))?(?:_\d+)?\.pdf$",
        path.name,
        re.I,
    )
    if not match:
        return 0, path.stem
    year = int(match.group(1))
    month_name = MONTHS[match.group(2).lower()][0]
    session = f"{month_name} {year}"
    if match.group(3):
        session += f" Shift {match.group(3)}"
    return year, session


def is_hindi_duplicate_page(text: str) -> bool:
    devanagari = len(re.findall(r"[\u0900-\u097F]", text))
    ascii_letters = len(re.findall(r"[A-Za-z]", text))
    return devanagari > 40 and ascii_letters < 20


def write_chunk(reader: PdfReader, start: int, end: int) -> bytes:
    writer = PdfWriter()
    for index in range(start, end):
        text = reader.pages[index].extract_text() or ""
        if not is_hindi_duplicate_page(text):
            writer.add_page(reader.pages[index])
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def retry429(operation: Any, description: str, attempts: int = 5) -> Any:
    delay = 10
    for attempt in range(attempts):
        try:
            return operation()
        except Exception as error:
            status = getattr(error, "status_code", None)
            message = str(error)
            if "quota exceeded" in message.lower() or "free tier" in message.lower():
                raise RuntimeError(
                    "Gemini daily quota exhausted. Direct PDF fallback remains available; "
                    "retry extraction after the quota resets."
                ) from error
            transient = status in {429, 503} or "429" in message or "503" in message
            if not transient or attempt == attempts - 1:
                raise
            print(f"{description}: retrying in {delay}s ({attempt + 1}/{attempts})", file=sys.stderr)
            time.sleep(delay)
            delay = min(delay * 2, 60)
    raise RuntimeError(description)


def extraction_prompt(year: int, session: str) -> str:
    return f"""Extract ONLY English UGC NET MCQs from this PDF chunk.
Exam: {year}, {session}.
Prepend relevant shared DI tables, reading comprehension passages, code blocks, or disk queues in Markdown.
Skip image-only options and Hindi-only duplicate text.
Verify the answer and return concise step-by-step explanations.
Map Paper 1 Q1-Q50 to unit_number 101-110 and Paper 2 to unit_number 1-10.
Output only the supplied JSON schema."""


def extract_only(client: genai.Client, pdf_dir: Path) -> None:
    extracted_path = WORKSPACE_ROOT / "data" / "extracted_pyqs.json"
    checkpoint_path = WORKSPACE_ROOT / "scripts" / ".seeded_files.json"
    extracted = load_json(extracted_path, {})
    checkpoint = load_json(checkpoint_path, {})
    pdfs = sorted(pdf_dir.glob("*.pdf"), key=lambda p: p.name, reverse=True)

    for pdf in pdfs:
        year, session = parse_filename(pdf)
        reader = PdfReader(str(pdf))
        state = checkpoint.setdefault(pdf.name, {"completed_end_page": 0})
        start = int(state.get("completed_end_page", 0))
        for chunk_start in range(start, len(reader.pages), 4):
            chunk_end = min(chunk_start + 4, len(reader.pages))
            chunk = write_chunk(reader, chunk_start, chunk_end)
            if not chunk:
                continue
            part = types.Part.from_bytes(data=chunk, mime_type="application/pdf")
            response = retry429(
                lambda: client.models.generate_content(
                    model="gemini-3.8-flash",
                    contents=[part, extraction_prompt(year, session)],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_json_schema=ExtractionBatch.model_json_schema(),
                    ),
                ),
                f"Extracting {pdf.name} pages {chunk_start + 1}-{chunk_end}",
            )
            batch = ExtractionBatch.model_validate_json(response.text)
            for question in batch.questions:
                key = normalize_text(question.question_id or question.question_text)
                extracted[key] = {
                    **question.model_dump(),
                    "exam_year": year,
                    "exam_session": session,
                    "source_type": "PYQ",
                }
            state["completed_end_page"] = chunk_end
            save_json(extracted_path, extracted)
            save_json(checkpoint_path, checkpoint)
            print(f"Saved checkpoint {pdf.name}: pages {chunk_start + 1}-{chunk_end}")
            time.sleep(5)
    print(f"Extraction complete: {len(extracted)} unique questions in {extracted_path}")


def upload_only(database_url: str) -> None:
    extracted_path = WORKSPACE_ROOT / "data" / "extracted_pyqs.json"
    extracted = load_json(extracted_path, {})
    if not extracted:
        raise SystemExit("No extracted questions found")

    connection = psycopg2.connect(database_url)
    try:
        with connection.cursor() as cursor:
            cursor.execute("select question_id, question_text from questions")
            existing = cursor.fetchall()
        existing_ids = {row[0] for row in existing if row[0]}
        existing_text = {normalize_text(row[1]) for row in existing}

        pending = []
        seen = set()
        for item in extracted.values():
            text_key = normalize_text(item["question_text"])
            question_id = item.get("question_id")
            if text_key in existing_text or text_key in seen:
                continue
            if question_id and question_id in existing_ids:
                continue
            if item["correct_option"] not in {"A", "B", "C", "D"}:
                continue
            seen.add(text_key)
            pending.append(item)

        inserted = 0
        for start in range(0, len(pending), 50):
            batch = pending[start:start + 50]
            try:
                with connection.cursor() as cursor:
                    cursor.executemany(
                        """insert into questions
                        (paper, unit_number, unit_name, question_text, options, option_a, option_b, option_c, option_d,
                         correct_option, explanation, source_type, exam_year, exam_session, question_id)
                        values (%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s,'PYQ',%s,%s,%s)
                        on conflict (question_id) do nothing""",
                        [
                            (
                                item["paper"], item["unit_number"], item["unit_name"], item["question_text"],
                                json.dumps({
                                    "A": item["option_a"],
                                    "B": item["option_b"],
                                    "C": item["option_c"],
                                    "D": item["option_d"],
                                }),
                                item["option_a"], item["option_b"], item["option_c"], item["option_d"],
                                item["correct_option"], item["explanation"], item.get("exam_year"),
                                item.get("exam_session"), item.get("question_id"),
                            )
                            for item in batch
                        ],
                    )
                connection.commit()
                inserted += cursor.rowcount if "cursor" in locals() else len(batch)
                print(f"Uploaded batch {start + 1}-{min(start + 50, len(pending))}")
            except Exception as error:
                connection.rollback()
                print(f"Batch {start + 1}-{start + len(batch)} failed: {error}", file=sys.stderr)
        print(f"Upload summary: {inserted} inserted, {len(pending) - inserted} skipped")
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", default="pyq_pdfs")
    parser.add_argument("--extract-only", action="store_true")
    parser.add_argument("--upload-only", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--database-url")
    args = parser.parse_args()

    if args.upload_only:
        database_url = args.database_url or os.environ.get("DATABASE_URL")
        if not database_url:
            raise SystemExit("DATABASE_URL is required for --upload-only")
        upload_only(database_url)
        return

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("GEMINI_API_KEY is required")
    client = genai.Client(api_key=api_key)
    pdf_dir = WORKSPACE_ROOT / args.dir
    if not pdf_dir.exists():
        raise SystemExit(f"PDF directory not found: {pdf_dir}")

    if args.dry_run:
        pdf = sorted(pdf_dir.glob("*.pdf"), reverse=True)[0]
        reader = PdfReader(str(pdf))
        year, session = parse_filename(pdf)
        chunk = write_chunk(reader, 0, min(4, len(reader.pages)))
        part = types.Part.from_bytes(data=chunk, mime_type="application/pdf")
        response = retry429(
            lambda: client.models.generate_content(
                model="gemini-3.8-flash",
                contents=[part, extraction_prompt(year, session)],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=ExtractionBatch.model_json_schema(),
                ),
            ),
            "Dry-run extraction",
        )
        print(response.text)
        return

    extract_only(client, pdf_dir)


if __name__ == "__main__":
    main()
