import paramiko, sys, time

HOST   = "49.13.132.184"
USER   = "root"
PASS   = "Estrategy2026"
REMOTE = "/root/estrategia"
MIG    = r"D:\estrategia\backend\src\database\migrations\092_planning_rtn.sql"
SEED   = r"D:\estrategia\scripts\seed_caja_ande_planning.sql"

def run(t, cmd, timeout=300):
    ch = t.open_session()
    ch.exec_command(cmd)
    out, err = b"", b""
    dl = time.time() + timeout
    while time.time() < dl:
        if ch.recv_ready():        out += ch.recv(65536)
        if ch.recv_stderr_ready(): err += ch.recv_stderr(65536)
        if ch.exit_status_ready(): break
        time.sleep(0.3)
    rc = ch.recv_exit_status()
    return rc, out.decode("utf-8", "replace"), err.decode("utf-8", "replace")

t = paramiko.Transport((HOST, 22))
t.connect(username=USER, password=PASS)

# Upload files
sftp = paramiko.SFTPClient.from_transport(t)
sftp.put(MIG,  "/tmp/mig092.sql"); print("Uploaded mig092.sql")
sftp.put(SEED, "/tmp/seed_planning.sql"); print("Uploaded seed_planning.sql")
sftp.close()

steps = [
    ("migration 092",  "sudo -u postgres psql -d okr_db -f /tmp/mig092.sql 2>&1; rm /tmp/mig092.sql", 60),
    ("seed planning",  "sudo -u postgres psql -d okr_db -f /tmp/seed_planning.sql 2>&1; rm /tmp/seed_planning.sql", 30),
    ("git pull",       f"cd {REMOTE} && git pull origin main 2>&1 | tail -5", 30),
    ("build backend",  f"cd {REMOTE}/backend && npm run build 2>&1 | tail -5", 300),
    ("restart backend","pm2 restart okr-backend 2>&1 | tail -3", 30),
    ("build frontend", f"rm -rf {REMOTE}/frontend/.next && cd {REMOTE}/frontend && npm run build 2>&1 | tail -5", 420),
    ("restart frontend","pm2 restart okr-frontend 2>&1 | tail -3", 30),
    ("smoke test",     "sleep 4 && curl -s -o /dev/null -w '%{http_code}' http://localhost:3020/api/v1/planning/sessions", 15),
]

for label, cmd, timeout in steps:
    sys.stdout.buffer.write(f"\n[{label}]\n".encode())
    sys.stdout.buffer.flush()
    rc, out, err = run(t, cmd, timeout)
    sys.stdout.buffer.write(f"RC={rc}\n{out[:2000]}\n{err[:400]}\n".encode("utf-8", "replace"))
    sys.stdout.buffer.flush()
    if rc != 0 and label not in ("migration 092", "seed planning"):
        sys.stdout.buffer.write(b"STOP\n")
        break

t.close()
