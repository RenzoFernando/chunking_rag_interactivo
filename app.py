import argparse
import json
import shutil
import tempfile
import webbrowser
import zipfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
RESULTS_JSON = DATA_DIR / "results.json"
METRICS_CSV = DATA_DIR / "metrics.csv"
RESULTS_JS = ROOT / "assets" / "js" / "results-data.js"
AUTO_PACKAGE = ROOT / "resultados_chunking_para_web.zip"


def load_results(path: Path):
    with path.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if payload.get("schema_version") not in {3, 4}:
        raise ValueError("El results.json no corresponde a esta versión del experimento.")

    required = {"source", "run", "metrics", "strategies"}
    missing = required - set(payload)
    if missing:
        raise ValueError(f"Faltan campos en results.json: {', '.join(sorted(missing))}")

    return payload


def write_results(payload):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_JS.parent.mkdir(parents=True, exist_ok=True)

    RESULTS_JSON.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    RESULTS_JS.write_text(
        "window.RAG_RESULTS = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )


def import_results(source: Path):
    source = source.resolve()
    if not source.exists():
        raise FileNotFoundError(source)

    with tempfile.TemporaryDirectory() as temporary:
        temporary_path = Path(temporary)
        source_root = source

        if source.is_file() and source.suffix.lower() == ".zip":
            with zipfile.ZipFile(source, "r") as archive:
                archive.extractall(temporary_path)
            source_root = temporary_path
        elif source.is_file():
            raise ValueError("Usa un ZIP o una carpeta de resultados.")

        candidates = list(source_root.rglob("results.json"))
        if not candidates:
            raise FileNotFoundError("No se encontró results.json en los resultados.")

        payload = load_results(candidates[0])
        write_results(payload)

        csv_candidates = list(source_root.rglob("metrics.csv"))
        if csv_candidates:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            shutil.copy2(csv_candidates[0], METRICS_CSV)

    print("Resultados actualizados.")


def sync_results():
    payload = load_results(RESULTS_JSON)
    write_results(payload)
    print("Datos sincronizados con la landing.")


def auto_import_latest():
    if not AUTO_PACKAGE.exists():
        return
    if not RESULTS_JSON.exists() or AUTO_PACKAGE.stat().st_mtime > RESULTS_JSON.stat().st_mtime:
        import_results(AUTO_PACKAGE)


def serve(port: int, open_browser: bool):
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    url = f"http://127.0.0.1:{port}/"
    print(f"Presentación disponible en {url}")
    if open_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
    finally:
        server.server_close()


def parse_args():
    parser = argparse.ArgumentParser(description="Sirve la landing y permite importar resultados del notebook.")
    parser.add_argument("--import-results", type=Path, help="ZIP o carpeta generada por el notebook.")
    parser.add_argument("--sync", action="store_true", help="Regenera results-data.js desde data/results.json.")
    parser.add_argument("--no-serve", action="store_true")
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--port", type=int, default=8000)
    return parser.parse_args()


def main():
    args = parse_args()

    if args.import_results:
        import_results(args.import_results)
    elif args.sync:
        sync_results()
    else:
        auto_import_latest()

    if not args.no_serve:
        serve(args.port, not args.no_browser)


if __name__ == "__main__":
    main()
