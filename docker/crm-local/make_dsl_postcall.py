"""Generates agentic_crm_postcall.yml: transcript -> summary / BANT+next steps / follow-up
-> human review form -> CRM write. See dsl_common.py for how to run it."""
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0] if "/" in __file__ else ".")
from dsl_common import *  # noqa: E402,F401,F403

start = node("start", 40, 260, {
    "title": "Call transcript", "type": "start",
    "variables": [
        {"variable": "contact_email", "label": "Contact email", "type": "text-input", "required": True, "max_length": 200, "options": []},
        {"variable": "call_type", "label": "Call type", "type": "select", "required": True, "max_length": 48,
         "options": ["Discovery", "Demo", "Proposal and pricing review", "Negotiation", "Closing"]},
        {"variable": "transcript", "label": "Transcript", "type": "paragraph", "required": True, "max_length": 30000, "options": []},
    ]}, h=118)

history = crm_history_node("crm_history", 330, 260, "{{#start.contact_email#}}")

CONTEXT = lines(
    "Call type: {{#start.call_type#}}",
    "",
    "CRM record before the call (JSON):",
    "{{#crm_history.body#}}",
    "",
    "Transcript:",
    "{{#start.transcript#}}",
)

summary = llm_node("summary", 620, 260, "Call summary",
    lines("You summarize sales calls for the CRM. Use ONLY what is in the transcript. Do not invent facts.",
          "Output markdown: 5 short bullets covering what was discussed, then 'Objections raised:' and",
          "'Commitments made (by whom):' lists. Write 'None' for an empty list."),
    CONTEXT)

bant = llm_node("bant", 910, 260, "BANT + next steps",
    lines("You update BANT fields and next steps from a sales call. Use ONLY the transcript and the CRM record.",
          "Never invent facts; label inferences as 'Inferred'. Output markdown with:",
          "## BANT changes (for Budget, Authority, Need, Timeline: Unchanged / Updated: <new info> / Unknown)",
          "## Next steps (each with owner and date if stated in the call, otherwise 'date not stated')",
          "## Suggested stage change (Suggestion only: one stage name or 'No change', with a one-line reason)"),
    CONTEXT)

followup = llm_node("followup", 1200, 260, "Follow-up email",
    lines("You write the recap email a sales rep sends after a call. Under 150 words, friendly and specific.",
          "Mention ONLY next steps and commitments that were actually agreed in the transcript.",
          "Do not offer discounts, prices or terms that were not agreed. Output the email body only."),
    CONTEXT, temperature=0.4)

review = node("review", 1490, 220, {
    "title": "Review before CRM update", "type": "human-input",
    "delivery_methods": [{"enabled": True, "id": "7a2d9e10-3b4c-4d5e-8f60-1a2b3c4d5e6f", "type": "webapp"}],
    "form_content": lines(
        "Review and edit what will be logged to the CRM and sent as the follow-up.",
        "",
        "**Call summary**",
        "{{#$output.call_summary#}}",
        "",
        "**BANT changes and next steps**",
        "{{#$output.bant_updates#}}",
        "",
        "**Follow-up email draft**",
        "{{#$output.followup_email#}}"),
    "inputs": [
        {"type": "paragraph", "output_variable_name": "call_summary",
         "default": {"type": "variable", "selector": ["summary", "text"], "value": ""}},
        {"type": "paragraph", "output_variable_name": "bant_updates",
         "default": {"type": "variable", "selector": ["bant", "text"], "value": ""}},
        {"type": "paragraph", "output_variable_name": "followup_email",
         "default": {"type": "variable", "selector": ["followup", "text"], "value": ""}},
    ],
    "user_actions": [
        {"id": "approve", "title": "Approve and log to CRM", "button_style": "primary"},
        {"id": "reject", "title": "Reject", "button_style": "default"},
    ],
    "timeout": 1, "timeout_unit": "day"}, h=240)

PY = lines(
    "import json",
    "",
    "def main(email: str, call_type: str, call_summary: str, bant_updates: str, followup_email: str) -> dict:",
    "    payload = {",
    "        'contact_email': email,",
    "        'type': 'call',",
    "        'call_type': call_type,",
    "        'summary': call_summary + '\\n\\nBANT changes and next steps:\\n' + bant_updates,",
    "        'followup_email_draft': followup_email,",
    "    }",
    "    return {'payload': json.dumps(payload)}",
)
build = node("build_payload", 1790, 150, {
    "title": "Build CRM payload", "type": "code", "code_language": "python3", "code": PY,
    "variables": [
        {"variable": "email", "value_selector": ["start", "contact_email"]},
        {"variable": "call_type", "value_selector": ["start", "call_type"]},
        {"variable": "call_summary", "value_selector": ["review", "call_summary"]},
        {"variable": "bant_updates", "value_selector": ["review", "bant_updates"]},
        {"variable": "followup_email", "value_selector": ["review", "followup_email"]},
    ],
    "outputs": {"payload": {"type": "string", "children": None}}})

crm = node("crm_write", 2090, 150, {
    "title": "Log to CRM", "type": "http-request",
    "method": "post", "url": "{{#env.CRM_BASE_URL#}}/crm/activities",
    "authorization": {"type": "no-auth"},
    "headers": "Idempotency-Key:{{#sys.workflow_run_id#}}\nContent-Type:application/json",
    "params": "",
    "body": {"type": "raw-text", "data": [{"key": "", "type": "text", "value": "{{#build_payload.payload#}}"}]},
    "timeout": {"connect": 10, "read": 30, "write": 30}, "retry_config": RETRY})

end_ok = node("end_logged", 2390, 150, {"title": "Logged", "type": "end", "outputs": [
    {"variable": "crm_response", "value_type": "string", "value_selector": ["crm_write", "body"]}]})
end_rej = node("end_rejected", 1790, 330, {"title": "Rejected (nothing logged)", "type": "end", "outputs": [
    {"variable": "rejected_action", "value_type": "string", "value_selector": ["review", "__action_id"]}]})
end_to = node("end_timeout", 1790, 450, {"title": "Timed out (nothing logged)", "type": "end", "outputs": [
    {"variable": "timeout_action", "value_type": "string", "value_selector": ["review", "__action_id"]}]})

edges = [
    edge("start", "source", "crm_history", "start", "http-request"),
    edge("crm_history", "source", "summary", "http-request", "llm"),
    edge("summary", "source", "bant", "llm", "llm"),
    edge("bant", "source", "followup", "llm", "llm"),
    edge("followup", "source", "review", "llm", "human-input"),
    edge("review", "approve", "build_payload", "human-input", "code"),
    edge("review", "reject", "end_rejected", "human-input", "end"),
    edge("review", "__timeout", "end_timeout", "human-input", "end"),
    edge("build_payload", "source", "crm_write", "code", "http-request"),
    edge("crm_write", "source", "end_logged", "http-request", "end"),
]

emit({"name": "Post-call update", "mode": "workflow", "icon": "\U0001F4DD", "icon_type": "emoji",
      "icon_background": "#E3F7E8",
      "description": "Transcript -> summary, BANT + next steps, follow-up draft -> human review -> CRM log.",
      "use_icon_as_answer_icon": False},
     [start, history, summary, bant, followup, review, build, crm, end_ok, end_rej, end_to], edges)
