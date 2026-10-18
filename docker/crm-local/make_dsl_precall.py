"""Generates agentic_crm_precall_brief.yml (Dify workflow DSL). Run inside the api container:
  docker compose exec -T api python - < crm-local/make_dsl_precall.py > crm-local/agentic_crm_precall_brief.yml
"""
import sys
import yaml

PROVIDER = "langgenius/openai_api_compatible/openai_api_compatible"
MODEL = "qwen3.5-9b"


def node(id_, x, y, data, h=90):
    return {
        "data": {**data, "selected": False}, "height": h, "id": id_,
        "position": {"x": x, "y": y}, "positionAbsolute": {"x": x, "y": y},
        "selected": False, "sourcePosition": "right", "targetPosition": "left",
        "type": "custom", "width": 244,
    }


def edge(src, handle, dst, stype, ttype):
    return {
        "data": {"isInIteration": False, "isInLoop": False, "sourceType": stype, "targetType": ttype},
        "id": f"{src}-{handle}-{dst}", "source": src, "sourceHandle": handle,
        "target": dst, "targetHandle": "target", "type": "custom", "zIndex": 0,
    }


retry = {"enabled": False, "max_retries": 1, "retry_interval": 1000,
         "exponential_backoff": {"enabled": False, "multiplier": 2, "max_interval": 10000}}

start = node("start", 40, 200, {
    "title": "Upcoming call", "type": "start",
    "variables": [
        {"variable": "contact_name", "label": "Contact name", "type": "text-input", "required": True, "max_length": 100, "options": []},
        {"variable": "contact_email", "label": "Contact email", "type": "text-input", "required": True, "max_length": 200, "options": []},
        {"variable": "company", "label": "Company", "type": "text-input", "required": True, "max_length": 200, "options": []},
        {"variable": "call_type", "label": "Call type", "type": "select", "required": True, "max_length": 48,
         "options": ["Discovery", "Demo", "Proposal and pricing review", "Negotiation", "Closing"]},
        {"variable": "notes", "label": "Your notes (optional)", "type": "paragraph", "required": False, "max_length": 4000, "options": []},
    ]}, h=118)

crm = node("crm_history", 340, 200, {
    "title": "CRM history", "type": "http-request",
    "method": "get", "url": "{{#env.CRM_BASE_URL#}}/crm/history",
    "authorization": {"type": "no-auth"}, "headers": "",
    "params": "email:{{#start.contact_email#}}",
    "body": {"type": "none", "data": []},
    "timeout": {"connect": 10, "read": 30, "write": 30}, "retry_config": retry})

SYSTEM = "\n".join([
    "You prepare sales reps for calls. Use ONLY the information given. Never invent facts about the",
    "company or contact; if something is unknown, say so under 'Unknown'. Output markdown with these sections:",
    "## Objective (one concrete outcome for this call type)",
    "## BANT: for Budget, Authority, Need, Timeline give Known / Unknown / Guess (label guesses as guesses)",
    "## History (bullet summary of prior activity)",
    "## Discovery questions (exactly 3, open-ended)",
    "## Risks and watch-outs",
])
USER = "\n".join([
    "Call type: {{#start.call_type#}}",
    "Contact: {{#start.contact_name#}} <{{#start.contact_email#}}> at {{#start.company#}}",
    "",
    "CRM history (JSON):",
    "{{#crm_history.body#}}",
    "",
    "Rep notes:",
    "{{#start.notes#}}",
])

llm = node("brief", 640, 200, {
    "title": "Write brief", "type": "llm",
    "model": {"provider": PROVIDER, "name": MODEL, "mode": "chat", "completion_params": {"temperature": 0.3}},
    "prompt_template": [{"role": "system", "text": SYSTEM}, {"role": "user", "text": USER}],
    "vision": {"enabled": False}, "memory": None,
    "context": {"enabled": False, "variable_selector": []},
    "structured_output_enabled": False, "retry_config": retry}, h=118)

end = node("end", 940, 200, {"title": "Brief", "type": "end", "outputs": [
    {"variable": "brief", "value_type": "string", "value_selector": ["brief", "text"]}]})

edges = [
    edge("start", "source", "crm_history", "start", "http-request"),
    edge("crm_history", "source", "brief", "http-request", "llm"),
    edge("brief", "source", "end", "llm", "end"),
]

dsl = {
    "app": {"name": "Pre-call brief", "mode": "workflow", "icon": "\U0001F4DE", "icon_type": "emoji",
            "icon_background": "#E0EAFF",
            "description": "Read-only: CRM history + rep notes -> BANT gaps, objective, discovery questions.",
            "use_icon_as_answer_icon": False},
    "kind": "app", "version": "0.6.0", "dependencies": [],
    "workflow": {
        "conversation_variables": [],
        "environment_variables": [{"id": "6c1b3f0a-2d4e-4f6a-8b9c-1d2e3f4a5b6c", "name": "CRM_BASE_URL",
            "value": "http://host.docker.internal:8090", "value_type": "string",
            "description": "Mock CRM; replace with your CRM base URL"}],
        "features": {"file_upload": {"enabled": False}, "opening_statement": "", "retriever_resource": {"enabled": False},
                     "sensitive_word_avoidance": {"enabled": False}, "speech_to_text": {"enabled": False},
                     "suggested_questions": [], "suggested_questions_after_answer": {"enabled": False},
                     "text_to_speech": {"enabled": False, "language": "", "voice": ""}},
        "graph": {"edges": edges, "nodes": [start, crm, llm, end], "viewport": {"x": 0, "y": 0, "zoom": 0.8}},
        "rag_pipeline_variables": [],
    },
}
sys.stdout.write(yaml.safe_dump(dsl, allow_unicode=True, sort_keys=False))
