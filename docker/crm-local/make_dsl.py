"""Generates agentic_crm_phase1.yml (Dify workflow DSL). Run inside the api container:
  docker compose exec -T api python - < crm-local/make_dsl.py > crm-local/agentic_crm_phase1.yml
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

start = node("start", 40, 260, {
    "title": "Lead inquiry", "type": "start",
    "variables": [
        {"variable": "lead_name", "label": "Lead name", "type": "text-input", "required": True, "max_length": 100, "options": []},
        {"variable": "lead_email", "label": "Lead email", "type": "text-input", "required": True, "max_length": 200, "options": []},
        {"variable": "inquiry", "label": "Inquiry", "type": "paragraph", "required": True, "max_length": 4000, "options": []},
    ]})

llm = node("draft", 340, 260, {
    "title": "Draft reply", "type": "llm",
    "model": {"provider": PROVIDER, "name": MODEL, "mode": "chat", "completion_params": {"temperature": 0.4}},
    "prompt_template": [
        {"role": "system", "text": "You are a sales assistant. Write a concise, friendly, accurate reply to the lead. "
                                   "Do not invent prices, discounts or commitments. Output only the email body."},
        {"role": "user", "text": "Lead: {{#start.lead_name#}} <{{#start.lead_email#}}>\n\nInquiry:\n{{#start.inquiry#}}"},
    ],
    "vision": {"enabled": False}, "memory": None,
    "context": {"enabled": False, "variable_selector": []},
    "structured_output_enabled": False, "retry_config": retry}, h=118)

hitl = node("review", 640, 240, {
    "title": "Review draft", "type": "human-input",
    "delivery_methods": [{"enabled": True, "id": "5b1f0c2e-7d3a-4c1e-9a52-0a1b2c3d4e5f", "type": "webapp"}],
    "form_content": "Review and edit the draft reply to **{{#start.lead_name#}}**.\n\n{{#$output.reply#}}",
    "inputs": [{"type": "paragraph", "output_variable_name": "reply",
                "default": {"type": "variable", "selector": ["draft", "text"], "value": ""}}],
    "user_actions": [
        {"id": "approve", "title": "Approve and send", "button_style": "primary"},
        {"id": "reject", "title": "Reject", "button_style": "default"},
    ],
    "timeout": 1, "timeout_unit": "day"}, h=220)

PY = "\n".join([
    "import json",
    "",
    "def main(name: str, email: str, reply: str) -> dict:",
    "    payload = {'contact_name': name, 'contact_email': email, 'type': 'email_reply', 'approved_body': reply}",
    "    return {'payload': json.dumps(payload)}",
])
build = node("build_payload", 800, 160, {
    "title": "Build CRM payload", "type": "code", "code_language": "python3", "code": PY,
    "variables": [
        {"variable": "name", "value_selector": ["start", "lead_name"]},
        {"variable": "email", "value_selector": ["start", "lead_email"]},
        {"variable": "reply", "value_selector": ["review", "reply"]},
    ],
    "outputs": {"payload": {"type": "string", "children": None}}})

crm = node("crm_write", 1100, 160, {
    "title": "Write to CRM", "type": "http-request",
    "method": "post", "url": "{{#env.CRM_BASE_URL#}}/crm/activities",
    "authorization": {"type": "no-auth"},
    "headers": "Idempotency-Key:{{#sys.workflow_run_id#}}\nContent-Type:application/json",
    "params": "",
    "body": {"type": "raw-text", "data": [{"key": "", "type": "text", "value": "{{#build_payload.payload#}}"}]},
    "timeout": {"connect": 10, "read": 30, "write": 30}, "retry_config": retry})


end_ok = node("end_sent", 1400, 160, {"title": "Sent", "type": "end", "outputs": [
    {"variable": "crm_response", "value_type": "string", "value_selector": ["crm_write", "body"]}]})
end_rej = node("end_rejected", 960, 320, {"title": "Rejected (no write)", "type": "end", "outputs": [
    {"variable": "rejected_action", "value_type": "string", "value_selector": ["review", "__action_id"]}]})
end_to = node("end_timeout", 960, 440, {"title": "Timed out (no write)", "type": "end", "outputs": [
    {"variable": "timeout_action", "value_type": "string", "value_selector": ["review", "__action_id"]}]})

edges = [
    edge("start", "source", "draft", "start", "llm"),
    edge("draft", "source", "review", "llm", "human-input"),
    edge("review", "approve", "build_payload", "human-input", "code"),
    edge("build_payload", "source", "crm_write", "code", "http-request"),
    edge("review", "reject", "end_rejected", "human-input", "end"),
    edge("review", "__timeout", "end_timeout", "human-input", "end"),
    edge("crm_write", "source", "end_sent", "http-request", "end"),
]

dsl = {
    "app": {"name": "Agentic CRM - Phase 1", "mode": "workflow", "icon": "\U0001F4BC", "icon_type": "emoji",
            "icon_background": "#FFEAD5", "description": "Lead inquiry -> LLM draft -> human review -> CRM write.",
            "use_icon_as_answer_icon": False},
    "kind": "app", "version": "0.6.0", "dependencies": [],
    "workflow": {
        "conversation_variables": [],
        "environment_variables": [{"id": "6c1b3f0a-2d4e-4f6a-8b9c-1d2e3f4a5b6c", "name": "CRM_BASE_URL",
            "value": "http://host.docker.internal:8090", "value_type": "string", "description": "Mock CRM; replace with your CRM base URL"}],
        "features": {"file_upload": {"enabled": False}, "opening_statement": "", "retriever_resource": {"enabled": False},
                     "sensitive_word_avoidance": {"enabled": False}, "speech_to_text": {"enabled": False},
                     "suggested_questions": [], "suggested_questions_after_answer": {"enabled": False},
                     "text_to_speech": {"enabled": False, "language": "", "voice": ""}},
        "graph": {"edges": edges, "nodes": [start, llm, hitl, build, crm, end_ok, end_rej, end_to],
                  "viewport": {"x": 0, "y": 0, "zoom": 0.8}},
        "rag_pipeline_variables": [],
    },
}
sys.stdout.write(yaml.safe_dump(dsl, allow_unicode=True, sort_keys=False))
