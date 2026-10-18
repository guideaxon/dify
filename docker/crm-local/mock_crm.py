"""Tiny local stand-in for a CRM, to test the Dify workflows end to end.

Run on the Windows host:  python mock_crm.py   (listens on 0.0.0.0:8090)
Dify reaches it at http://host.docker.internal:8090.

Seed data (fictional contacts, last names Tester1..Tester6) is read from seed_data.json.

  GET  /crm/contacts                 list of seeded contacts (summary)
  GET  /crm/history?email=<addr>     contact, deal, BANT and all activities (seed + logged)
  GET  /crm/view?email=<addr>        the same, as a readable HTML page (for screen recordings)
  POST /crm/activities               log an activity (appended to mock_crm_log.jsonl)
  POST /crm/reset                    discard logged activities (seed data is untouched); only accepted when the
                                     request arrives from loopback, other machines on the network get 403

The server has no authentication, so run it only on a trusted machine. It listens on all interfaces because Dify's
containers reach it through host.docker.internal. Note that on Docker Desktop for Windows a container's request
arrives as 127.0.0.1, so the reset check protects against other computers, not against the containers.
"""
import json
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).parent
LOG = HERE / "mock_crm_log.jsonl"
SEED = {c["email"].lower(): c for c in json.loads((HERE / "seed_data.json").read_text(encoding="utf-8"))["contacts"]}

# Requests are handled on several threads. All access to the log file (append, read, reset) goes through this lock,
# so a read never sees a half-written line or a file that a reset deletes underneath it.
LOCK = threading.Lock()
LOOPBACK = ("127.0.0.1", "::1")


def logged_activities(email):
    with LOCK:
        lines = LOG.read_text(encoding="utf-8").splitlines() if LOG.exists() else []
    rows = []
    for line in lines:
        try:
            rec = json.loads(line)
        except ValueError:
            continue  # skip a damaged line rather than failing the whole request
        body = rec.get("body")
        if isinstance(body, dict) and str(body.get("contact_email", "")).lower() == email:
            rows.append({"date": rec["received_at"][:10], "type": body.get("type"),
                         "summary": body.get("approved_body") or body.get("summary"), "source": "logged",
                         "followup_email": body.get("followup_email_draft")})
    return rows


def email_block(row):
    """The approved follow-up email draft, shown under the activity summary (if the workflow sent one)."""
    import html

    text = row.get("followup_email")
    if not text:
        return ""
    return ("<div class='email'><b>Follow-up email draft (approved)</b><br>"
            + html.escape(str(text)).replace(chr(10), "<br>") + "</div>")


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, payload):
        out = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/crm/contacts":
            return self._send(200, {"contacts": [
                {k: c[k] for k in ("email", "first_name", "last_name", "company", "stage", "deal_amount", "owner")}
                for c in SEED.values()]})
        if url.path == "/crm/history":
            email = (parse_qs(url.query).get("email") or [""])[0].lower()
            contact = SEED.get(email)
            if not contact:
                return self._send(200, {"email": email, "contact": None, "activities": logged_activities(email)})
            info = {k: v for k, v in contact.items() if k != "activities"}
            acts = [{**a, "source": "seed"} for a in contact["activities"]] + logged_activities(email)
            return self._send(200, {"email": email, "contact": info, "activities": acts})
        if url.path == "/crm/view":
            return self._send_html(url)
        self._send(404, {"error": "not found"})

    def _send_html(self, url):
        """GET /crm/view?email=<addr>: the same data as /crm/history, as a readable page (for screen recordings)."""
        import html

        email = (parse_qs(url.query).get("email") or [""])[0].lower()
        contact = SEED.get(email)
        rows = ([{**a, "source": "seed"} for a in contact["activities"]] if contact else []) + logged_activities(email)
        head = "No such contact" if not contact else (
            f"{contact['first_name']} {contact['last_name']} &middot; {html.escape(contact['title'])}, "
            f"{html.escape(contact['company'])} &middot; stage: <b>{html.escape(contact['stage'])}</b>")
        body = "".join(
            f"<tr class='{r['source']}'><td>{html.escape(str(r['date']))}</td><td>{html.escape(str(r['type']))}</td>"
            f"<td>{html.escape(str(r['source']))}</td><td>{html.escape(str(r['summary'])).replace(chr(10), '<br>')}"
            f"{email_block(r)}</td></tr>"
            for r in rows)
        page = (
            "<!doctype html><meta charset='utf-8'><title>Mock CRM</title>"
            "<style>body{font:16px system-ui,Segoe UI,Arial;margin:32px;color:#101828}h1{font-size:22px}"
            "table{border-collapse:collapse;width:100%;margin-top:16px}td,th{border:1px solid #d0d5dd;padding:8px 12px;"
            "text-align:left;vertical-align:top}th{background:#f2f4f7}tr.logged{background:#ecfdf3}"
            ".note{color:#667085;margin-top:8px}.email{margin-top:12px;padding:10px 14px;border:2px solid #16a34a;border-radius:8px;background:#fff}</style>"
            f"<h1>Mock CRM &mdash; {head}</h1><div class='note'>{html.escape(email)}</div>"
            "<table><tr><th>Date</th><th>Type</th><th>Source</th><th>Summary</th></tr>" + body + "</table>"
            "<div class='note'>Green rows were logged by a workflow after approval.</div>"
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(page)))
        self.end_headers()
        self.wfile.write(page)

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode("utf-8", "replace")
        if urlparse(self.path).path == "/crm/reset":
            if self.client_address[0] not in LOOPBACK:
                return self._send(403, {"error": "reset is only accepted from the machine running the mock CRM"})
            with LOCK:
                LOG.unlink(missing_ok=True)
            return self._send(200, {"ok": True, "reset": True})
        try:
            parsed = json.loads(body) if body.strip().startswith("{") else body
        except ValueError:
            return self._send(400, {"error": "request body is not valid JSON"})
        record = {
            "id": str(uuid.uuid4()),
            "received_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "path": self.path,
            "idempotency_key": self.headers.get("Idempotency-Key"),
            "body": parsed,
        }
        with LOCK, LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        self._send(201, {"ok": True, "id": record["id"]})


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8090), Handler).serve_forever()
