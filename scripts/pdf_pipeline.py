"""Convert PDFs in Data_Sach to reviewable Markdown; OCR scans when available."""
from __future__ import annotations
import argparse, hashlib, json, logging, re, subprocess, sys, threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "Data_Sach"
OUT_DIR = ROOT / "data" / "markdown-processed"
STATE = ROOT / "data" / ".pdf-state.json"
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def clean_markdown(text: str) -> str:
    lines = [line.rstrip() for line in text.splitlines()]
    counts: dict[str, int] = {}
    for line in lines:
        normalized = re.sub(r"\s+", " ", line.strip())
        if normalized and len(normalized) < 100:
            counts[normalized] = counts.get(normalized, 0) + 1
    repeated = {line for line, count in counts.items() if count >= 3 and ("trang" in line.lower() or line.isdigit() or len(line) < 45)}
    result: list[str] = []
    for line in lines:
        normalized = re.sub(r"\s+", " ", line.strip())
        if normalized in repeated:
            continue
        if result and line and not result[-1].endswith((".", ":", ";", "!", "?", "。", "！", "？")) and not line.startswith("#"):
            result[-1] += " " + line.strip()
        else:
            result.append(line)
    return "\n".join(result).strip() + "\n"

def convert(path: Path) -> None:
    try:
        import pymupdf as fitz
    except ImportError:
        import fitz
    output = OUT_DIR / f"{path.stem}.md"
    file_hash = digest(path)
    state = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
    if state.get(str(path), {}).get("sha256") == file_hash and output.exists():
        logging.info("SKIP unchanged: %s", path.name); return
    document = fitz.open(path)
    text_pages = [page.get_text("text").strip() for page in document]
    character_count = sum(len(page) for page in text_pages)
    ocr_used = character_count < max(100, len(document) * 40)
    if ocr_used:
        try:
            import pytesseract
            from PIL import Image
            from io import BytesIO
            tesseract_candidates = [Path("C:/Program Files/Tesseract-OCR/tesseract.exe"), Path("C:/Program Files (x86)/Tesseract-OCR/tesseract.exe")]
            for executable in tesseract_candidates:
                if executable.exists():
                    pytesseract.pytesseract.tesseract_cmd = str(executable)
                    break
            local_tessdata = ROOT / "data" / "tessdata"
            if (local_tessdata / "vie.traineddata").exists():
                pytesseract.pytesseract.tesseract_cmd = pytesseract.pytesseract.tesseract_cmd
                ocr_config = f"--tessdata-dir {local_tessdata}"
            else:
                ocr_config = ""
            text_pages = []
            for page in document:
                pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                text_pages.append(pytesseract.image_to_string(Image.open(BytesIO(pixmap.tobytes("png"))), lang="vie", config=ocr_config))
        except Exception as error:
            logging.error("OCR unavailable for %s: %s. Install Tesseract with vie language data.", path.name, error)
            return
    else:
        try:
            import pymupdf4llm
            markdown = pymupdf4llm.to_markdown(str(path), page_chunks=False)
        except Exception:
            markdown = "\n\n".join(text_pages)
        text_pages = [markdown]
    output.write_text(clean_markdown("\n\n".join(text_pages)), encoding="utf-8")
    state[str(path)] = {"sha256": file_hash, "ocr": ocr_used, "output": str(output)}
    STATE.parent.mkdir(parents=True, exist_ok=True); STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    logging.info("DONE %s -> %s (ocr=%s)", path.name, output.name, ocr_used)
    subprocess.run(["npm", "run", "parse:markdown"], cwd=ROOT, check=False, shell=sys.platform == "win32")

def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument("--watch", action="store_true"); parser.add_argument("--only", help="Process one PDF filename") ; args = parser.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    paths = [PDF_DIR / args.only] if args.only else sorted(PDF_DIR.glob("*.pdf"))
    for path in paths:
        if path.exists(): convert(path)
        else: logging.error("PDF not found: %s", path)
    if args.watch:
        from watchdog.events import FileSystemEventHandler
        from watchdog.observers import Observer
        pending: dict[str, threading.Timer] = {}
        def process_after_copy(path: Path) -> None:
            key = str(path).lower()
            try:
                first_size = path.stat().st_size
            except FileNotFoundError:
                return
            def run_if_stable() -> None:
                try:
                    second_size = path.stat().st_size
                except FileNotFoundError:
                    return
                if first_size != second_size:
                    process_after_copy(path)
                else:
                    pending.pop(key, None); convert(path)
            pending[key] = threading.Timer(2.0, run_if_stable); pending[key].daemon = True; pending[key].start()
        class Handler(FileSystemEventHandler):
            def on_created(self, event):
                if not event.is_directory and event.src_path.lower().endswith(".pdf"): process_after_copy(Path(event.src_path))
            def on_modified(self, event):
                if not event.is_directory and event.src_path.lower().endswith(".pdf") and str(event.src_path).lower() not in pending: process_after_copy(Path(event.src_path))
        observer = Observer(); observer.schedule(Handler(), str(PDF_DIR), recursive=False); observer.start(); logging.info("Watching %s", PDF_DIR)
        try:
            while True: observer.join(1)
        except KeyboardInterrupt: observer.stop(); observer.join()
if __name__ == "__main__": main()