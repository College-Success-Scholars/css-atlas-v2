#!/usr/bin/env python3
"""Own a local Next.js instance and retain public browser verification evidence."""

import argparse
import os
from pathlib import Path
import shlex
import signal
import socket
import subprocess
import time
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[4]
FRONTEND = ROOT / "frontend"
# npm workspaces hoist `next` to the root node_modules; it only stays under
# frontend/ if another package pins a conflicting version.
NEXT_BIN = next(
    (
        candidate
        for candidate in (
            FRONTEND / "node_modules/next/dist/bin/next",
            ROOT / "node_modules/next/dist/bin/next",
        )
        if candidate.exists()
    ),
    ROOT / "node_modules/next/dist/bin/next",
)
DRIVER = ROOT / ".audit/verify-tools/node_modules/.bin/agent-browser"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def free_port(port):
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", port))


def doctor(run):
    pid = int((run / "next.pid").read_text())
    port = int((run / "port").read_text())
    os.kill(pid, 0)
    owner = subprocess.check_output(
        ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"], text=True
    ).split()
    if not owner or any(os.getpgid(int(p)) != pid for p in owner):
        raise RuntimeError("Port is not owned by this run's Next.js process group")
    with urlopen(f"http://127.0.0.1:{port}/", timeout=60) as response:
        html = response.read().decode()
        if response.status != 200 or "Your engagement, one clear view" not in html:
            raise RuntimeError("Landing page is not usable")
    return f"PASS doctor: owned PID {pid}, port {port}, CSS Atlas landing rendered"


def run_owned(args):
    run = args.run_dir.resolve()
    run.mkdir(parents=True, exist_ok=False)
    free_port(args.port)
    free_port(args.port + 1)
    if (FRONTEND / ".next/dev/lock").exists():
        raise RuntimeError(
            "Existing frontend dev lock; do not double-drive this checkout"
        )
    if not (ROOT / "shared/dist/auth.js").is_file():
        raise RuntimeError("Build shared first: snip npm run build -w @css-atlas/shared")
    if args.command == "smoke" and not DRIVER.is_file():
        raise RuntimeError("Install the documented project-local agent-browser first")
    if args.command == "smoke" and not Path(args.chrome).is_file():
        raise RuntimeError(
            "Chrome executable not found; pass --chrome with an installed browser"
        )
    env = dict(os.environ)
    env.update(
        BACKEND_URL=f"http://127.0.0.1:{args.port + 1}",
        NEXT_PUBLIC_BACKEND_URL=f"http://127.0.0.1:{args.port + 1}",
        NEXT_TELEMETRY_DISABLED="1",
    )
    browser_env = {k: v for k, v in env.items() if not k.startswith("AGENT_BROWSER_")}
    browser_env["AGENT_BROWSER_NO_VERSION_CHECK"] = "1"
    session = "atlas-" + run.name
    browser_base = [
        str(DRIVER),
        "--session",
        session,
        "--namespace",
        session,
        "--no-auto-connect",
        "--allowed-domains",
        "127.0.0.1,localhost",
        "--executable-path",
        args.chrome,
    ]
    browser_started = False
    process = None

    def browser(*command, artifact=None):
        with (run / "actions.log").open("a") as log:
            log.write(shlex.join([*browser_base, *command]) + "\n")
        result = subprocess.run(
            [*browser_base, *command],
            env=browser_env,
            text=True,
            capture_output=True,
            timeout=120,
        )
        with (run / "actions.log").open("a") as log:
            log.write(result.stdout + result.stderr + f"\nexit={result.returncode}\n")
        if artifact:
            (run / artifact).write_text(result.stdout)
        result.check_returncode()
        return result.stdout

    def interrupted(signum, frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, interrupted)
    try:
        with (run / "server.log").open("w") as log:
            process = subprocess.Popen(
                [
                    "node",
                    str(NEXT_BIN),
                    "dev",
                    "--turbopack",
                    "--hostname",
                    "127.0.0.1",
                    "--port",
                    str(args.port),
                ],
                cwd=FRONTEND,
                env=env,
                stdout=log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
        (run / "next.pid").write_text(str(process.pid))
        (run / "port").write_text(str(args.port))
        deadline = time.monotonic() + 120
        while True:
            if process.poll() is not None:
                raise RuntimeError(f"Next.js exited; inspect {run / 'server.log'}")
            try:
                status = doctor(run)
                break
            except (OSError, RuntimeError, subprocess.CalledProcessError):
                if time.monotonic() >= deadline:
                    raise RuntimeError(
                        f"Readiness timed out; inspect {run / 'server.log'}"
                    )
                time.sleep(1)
        (run / "doctor.txt").write_text(status + "\n")
        print(status, flush=True)
        if args.command == "serve":
            print(f"Owned instance ready. Evidence directory: {run}", flush=True)
            process.wait()
            return
        browser_started = True
        browser("open", f"http://127.0.0.1:{args.port}/")
        browser("wait", "--text", "Your engagement, one clear view")
        landing = browser("snapshot", artifact="landing.aria.txt")
        if "Introduction" not in landing or "Sign in" not in landing:
            raise RuntimeError(
                "Landing page is missing the introduction or Sign in link"
            )
        browser("screenshot", str(run / "landing.png"))
        browser("find", "role", "link", "click", "--name", "Sign in", "--exact")
        browser("wait", "--url", "**/auth/login")
        browser("wait", "--text", "Login to CSS Atlas")
        login = browser("snapshot", artifact="login.aria.txt")
        for label in ("Email", "Password", "Remember me", "Sign In"):
            if label not in login:
                raise RuntimeError(f"Login form is missing {label}")
        browser("screenshot", str(run / "login.png"))
        browser("errors", artifact="browser-errors.txt")
        (run / "result.txt").write_text(
            "PASS landing-to-login through the Sign in link. No login or valid traffic submission.\n"
        )
        print(f"PASS landing-to-login. Evidence: {run}", flush=True)
    finally:
        if browser_started:
            try:
                browser("close")
            except (subprocess.SubprocessError, OSError) as error:
                (run / "browser-cleanup-error.txt").write_text(str(error) + "\n")
        if process is not None:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
        (run / "cleanup.txt").write_text(
            "Owned server stopped. Evidence retained.\n"
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["smoke", "serve", "doctor"])
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--port", type=int, default=4310)
    parser.add_argument("--chrome", default=CHROME)
    args = parser.parse_args()
    if args.command == "doctor":
        print(doctor(args.run_dir.resolve()))
    else:
        run_owned(args)


if __name__ == "__main__":
    main()
