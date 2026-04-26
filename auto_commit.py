# /// script
# requires-python = ">=3.8"
# dependencies = ["watchdog"]
# ///
"""
Auto Commit & Push - AGROWTH
Memantau setiap perubahan file/folder dan otomatis commit + push ke GitHub.
"""

import subprocess
import time
import sys
from datetime import datetime
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

REPO_DIR = Path(__file__).parent.resolve()
DEBOUNCE_SECONDS = 3  # tunggu X detik setelah perubahan terakhir sebelum commit

# File/folder yang diabaikan
IGNORE_PATTERNS = {".git", "__pycache__", ".devin"}


def run_git(args: list[str]) -> tuple[int, str, str]:
    result = subprocess.run(
        ["git"] + args,
        cwd=REPO_DIR,
        capture_output=True,
        text=True,
    )
    return result.returncode, result.stdout.strip(), result.stderr.strip()


def has_changes() -> bool:
    code, out, _ = run_git(["status", "--porcelain"])
    return code == 0 and bool(out)


def auto_commit_push():
    if not has_changes():
        return

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n[{timestamp}] Perubahan terdeteksi, sedang commit...")

    run_git(["add", "-A"])

    commit_msg = f"auto: update {timestamp}"
    code, out, err = run_git(["commit", "-m", commit_msg])
    if code != 0:
        print(f"  Commit gagal: {err}")
        return
    print(f"  Commit: {commit_msg}")

    code, out, err = run_git(["push", "origin", "main"])
    if code != 0:
        print(f"  Push gagal: {err}")
    else:
        print(f"  Push berhasil ke origin/main")


class ChangeHandler(FileSystemEventHandler):
    def __init__(self):
        self._pending = False
        self._last_event_time = 0.0

    def _should_ignore(self, path: str) -> bool:
        parts = Path(path).parts
        return any(p in IGNORE_PATTERNS for p in parts)

    def on_any_event(self, event):
        if self._should_ignore(event.src_path):
            return
        # Reset debounce timer
        self._last_event_time = time.time()
        self._pending = True

    def flush_if_ready(self):
        """Dipanggil dari main loop untuk menjalankan commit setelah debounce."""
        if self._pending and (time.time() - self._last_event_time) >= DEBOUNCE_SECONDS:
            self._pending = False
            auto_commit_push()


def main():
    print("=" * 55)
    print("  AGROWTH - Auto Commit & Push")
    print(f"  Repo  : {REPO_DIR}")
    print(f"  Remote: origin/main")
    print(f"  Debounce: {DEBOUNCE_SECONDS} detik")
    print("  Tekan Ctrl+C untuk berhenti")
    print("=" * 55)

    handler = ChangeHandler()
    observer = Observer()
    observer.schedule(handler, str(REPO_DIR), recursive=True)
    observer.start()

    try:
        while True:
            handler.flush_if_ready()
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nDihentikan.")
        observer.stop()
    observer.join()


if __name__ == "__main__":
    main()
