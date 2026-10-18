"""Tiny local stand-in for a CRM, to test the Dify workflows end to end.

Run on the Windows host:  python mock_crm.py   (listens on 0.0.0.0:8090)
Dify reaches it at http://host.docker.internal:8090.

Seed data (fictional contacts, last names Tester1..Tester6) is read from seed_data.json.

  GET  /crm/contacts                 list of seeded contacts (summary)
  GET  /crm/history?email=<addr>     contact, deal, BANT and all activities (seed + logged)
  POST /crm/activities               log an activity (appended to mock_crm_log.jsonl)
  POST /crm/reset                    discard logged activities (seed data is untouched)
"""
import json
import time
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).parent
LOG = HERE / "mock_crm_log.jsonl"
SEED = {c["email"].lower(): c for c in json.loads((HERE / "seed_data.json").read_text(encoding="utf-8"))["contacts"]}


def logged_activities(email):
    rows = []
    if LOG.exists():
        for line in LOG.read_text(encoding="utf-8").splitlines():
            rec = json.loads(line)
            body = rec.get("body")
            if isinstance(body, dict) and str(body.get("contact_email", "")).lower() == email:
                rows.append({"date": rec["received_at"][:10], "type": body.get("type"),
                             "summary": body.get("approved_body") or body.get("summary"), "source": "logged"})
    return rows


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
        self._send(404, {"error": "not found"})

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode("utf-8", "replace")
        if urlparse(self.path).path == "/crm/reset":
            LOG.unlink(missing_ok=True)
            return self._send(200, {"ok": True, "reset": True})
        record = {
            "id": str(uuid.uuid4()),
            "received_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "path": self.path,
            "idempotency_key": self.headers.get("Idempotency-Key"),
            "body": json.loads(body) if body.strip().startswith("{") else body,
        }
        with LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        self._send(201, {"ok": True, "id": record["id"]})


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8090), Handler).serve_forever()
