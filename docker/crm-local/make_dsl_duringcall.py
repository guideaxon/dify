"""Generates agentic_crm_duringcall.yml: a simulated live call helper (chat app).
The rep pastes what the buyer just said; the helper suggests a response. The rep stays in control.
See dsl_common.py for how to run it."""
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0] if "/" in __file__ else ".")
from dsl_common import *  # noqa: E402,F401,F403

start = node("start", 40, 220, {
    "title": "Call setup", "type": "start",
    "variables": [
        {"variable": "contact_email", "label": "Contact email", "type": "text-input", "required": True, "max_length": 200, "options": []},
        {"variable": "call_type", "label": "Call type", "type": "select", "required": True, "max_length": 48,
         "options": ["Cold call", "Discovery", "Demo", "Proposal and pricing review", "Negotiation", "Closing"]},
    ]}, h=118)

history = crm_history_node("crm_history", 340, 220, "{{#start.contact_email#}}")

SYSTEM = lines(
    "You are a live call helper for a sales rep. The rep pastes what the buyer just said. The rep stays in control",
    "and decides what to say. Keep every reply under 120 words, in exactly this format:",
    "**Signal:** (buying signal, or the objection type: price, timing, authority, need, competitor, risk, other)",
    "**Suggested response:** (1-3 sentences the rep can say; use LAER, Listen-Acknowledge-Explore-Respond, or",
    "Feel-Felt-Found when handling an objection)",
    "**Next question:** (one open-ended question)",
    "Rules: use ONLY facts from the CRM record and the conversation. Never invent product claims, prices or",
    "references. Never say or imply that a price, discount or term is approved or available, and do not describe",
    "the budget as the proposal. If information is missing, say so.",
    "DISCOUNT RULE: if the buyer asks for a discount, a lower price, or any change to price or contract terms,",
    "the Suggested response MUST start with the exact words 'Hold: needs approval.' followed by one sentence that",
    "buys time (for example, acknowledge the request and offer a written answer). Never suggest agreeing.",
    "COMPETITOR RULE: if a competitor is mentioned, ask what is included in their quote and do not disparage them.",
    "",
    "Call type: {{#start.call_type#}}",
    "CRM record (JSON): {{#crm_history.body#}}",
)

helper = llm_node("helper", 640, 220, "Live suggestion", SYSTEM, "{{#sys.query#}}", temperature=0.4, memory={
    "role_prefix": {"user": "", "assistant": ""},
    "window": {"enabled": True, "size": 20},
    "query_prompt_template": "{{#sys.query#}}"})

answer = node("answer", 940, 220, {"title": "Answer", "type": "answer", "answer": "{{#helper.text#}}", "variables": []})

edges = [
    edge("start", "source", "crm_history", "start", "http-request"),
    edge("crm_history", "source", "helper", "http-request", "llm"),
    edge("helper", "source", "answer", "llm", "answer"),
]

features = {**FEATURES, "opening_statement":
            "Paste what the buyer just said and I will suggest a response and a next question. You stay in control of the call."}

emit({"name": "Live call helper (simulated)", "mode": "advanced-chat", "icon": "\U0001F3A7", "icon_type": "emoji",
      "icon_background": "#FDE8E8",
      "description": "Simulated during-call helper: paste the buyer's last words, get a signal, response and next question.",
      "use_icon_as_answer_icon": False},
     [start, history, helper, answer], edges, mode_features=features)
