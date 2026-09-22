"""
NewsGraph Single Command Launcher
Starts both the FastAPI Backend and Vite Frontend concurrently with a single command:
    python run.py
"""
import os
import sys
import subprocess
import signal
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"


def get_python_exe():
    # Check for backend/venv first, otherwise use current python
    venv_win = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
    venv_nix = BACKEND_DIR / "venv" / "bin" / "python"
    if venv_win.exists():
        return str(venv_win)
    if venv_nix.exists():
        return str(venv_nix)
    return sys.executable


def main():
    print("=" * 60)
    print("🚀 STARTING NEWSGRAPH (Backend + Frontend)")
    print("=" * 60)

    python_exe = get_python_exe()
    print(f"[*] Using Python: {python_exe}")
    print(f"[*] Backend Directory: {BACKEND_DIR}")
    print(f"[*] Frontend Directory: {FRONTEND_DIR}")
    print("-" * 60)

    # 1. Start Backend process
    backend_cmd = [
        python_exe,
        "-m",
        "uvicorn",
        "main:app",
        "--reload",
        "--port",
        "8000",
        "--host",
        "0.0.0.0",
    ]
    print("[+] Launching Backend on http://localhost:8000 ...")
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=str(BACKEND_DIR),
        shell=(os.name == "nt"),
    )

    # Give backend a brief moment to bind
    time.sleep(1.5)

    # 2. Start Frontend process
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    frontend_cmd = [npm_cmd, "run", "dev"]
    print("[+] Launching Frontend on http://localhost:5173 ...")
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=str(FRONTEND_DIR),
        shell=(os.name == "nt"),
    )

    print("-" * 60)
    print("✅ NEWSGRAPH IS RUNNING!")
    print("👉 Frontend: http://localhost:5173")
    print("👉 Backend API: http://localhost:8000/docs")
    print("👉 Default Login: admin123  /  Password: 123456")
    print("-" * 60)
    print("Press Ctrl + C to stop all servers.")
    print("=" * 60)

    procs = [backend_proc, frontend_proc]

    def cleanup(signum=None, frame=None):
        print("\nStopping NewsGraph servers...")
        for p in procs:
            try:
                if os.name == "nt":
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(p.pid)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                else:
                    p.terminate()
            except Exception:
                pass
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    try:
        while True:
            # Check if any process exited unexpectedly
            b_ret = backend_proc.poll()
            f_ret = frontend_proc.poll()
            if b_ret is not None or f_ret is not None:
                break
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()


if __name__ == "__main__":
    main()
