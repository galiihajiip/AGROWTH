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
PUSH_POLL_SECONDS = 30  # cek commit yang belum di-push setiap N detik

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
    """True kalau ada working-tree change (modified/untracked) yang belum di-commit."""
    code, out, _ = run_git(["status", "--porcelain"])
    return code == 0 and bool(out)


def has_unpushed_commits() -> bool:
    """True kalau HEAD di-depan ``origin/main`` (ada commit lokal belum di-push).

    Penting: skenario ini terjadi saat commit dibuat manual (mis. oleh
    Devin/IDE) di luar jalur ``auto_commit_push``. Tanpa cek ini script
    tidak akan pernah mendorong commit semacam itu.
    """
    # Sinkronkan refs remote dulu supaya perbandingan selalu up-to-date.
    run_git(["fetch", "origin", "main", "--quiet"])
    code, out, _ = run_git(
        ["rev-list", "--count", "origin/main..HEAD"],
    )
    if code != 0:
        return False
    try:
        return int(out) > 0
    except ValueError:
        return False


def push_only() -> None:
    """Push commit yang sudah ada tanpa membuat commit baru."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n[{timestamp}] Commit lokal belum ter-push, sedang push...")
    code, _out, err = run_git(["push", "origin", "main"])
    if code != 0:
        print(f"  Push gagal: {err}")
    else:
        print("  Push berhasil ke origin/main")


def auto_commit_push():
    """Tiga jalur:
    1. Working-tree dirty → ``git add -A`` + commit ``auto: update <ts>`` + push.
    2. Bersih tapi ada commit lokal yang belum di-push → push saja.
    3. Bersih dan sudah sinkron → no-op.
    """
    if has_changes():
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n[{timestamp}] Perubahan terdeteksi, sedang commit...")

        run_git(["add", "-A"])

        commit_msg = f"auto: update {timestamp}"
        code, _out, err = run_git(["commit", "-m", commit_msg])
        if code != 0:
            print(f"  Commit gagal: {err}")
            return
        print(f"  Commit: {commit_msg}")

        code, _out, err = run_git(["push", "origin", "main"])
        if code != 0:
            print(f"  Push gagal: {err}")
        else:
            print("  Push berhasil ke origin/main")
        return

    # Tidak ada perubahan working-tree — tetap cek commit yang nyangkut.
    if has_unpushed_commits():
        push_only()


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
    print(f"  Debounce      : {DEBOUNCE_SECONDS} detik (file change → commit)")
    print(f"  Push poll     : {PUSH_POLL_SECONDS} detik (catch manual commits)")
    print("  Tekan Ctrl+C untuk berhenti")
    print("=" * 55)

    handler = ChangeHandler()
    observer = Observer()
    observer.schedule(handler, str(REPO_DIR), recursive=True)
    observer.start()

    # Push commit lokal sekali di awal kalau ada yang nyangkut.
    if has_unpushed_commits():
        push_only()

    last_push_check = time.time()

    try:
        while True:
            handler.flush_if_ready()
            now = time.time()

            # Poll periodik: meng-handle commit manual (mis. dari Devin/IDE)
            # yang tidak men-trigger ChangeHandler. Tanpa ini, commit yang
            # dibuat lewat IDE tanpa modifikasi file lain akan stuck di local.
            if now - last_push_check >= PUSH_POLL_SECONDS:
                last_push_check = now
                if has_unpushed_commits():
                    push_only()

            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nDihentikan.")
        observer.stop()
    observer.join()


if __name__ == "__main__":
    main()
