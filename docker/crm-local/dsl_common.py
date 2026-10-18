"""Shared helpers for the DSL generators (make_dsl_postcall.py, make_dsl_duringcall.py).

Run a generator inside the api container so PyYAML is available:
  docker cp crm-local docker-api-1:/tmp/crm
  docker compose exec -T api python /tmp/crm/make_dsl_postcall.py > crm-local/agentic_crm_postcall.yml
"""
import sys
import yaml

PROVIDER = "langgenius/openai_api_compatible/openai_api_compatible"
MODEL = "qwen3.5-9b"

RETRY = {"enabled": False, "max_retries": 1, "retry_interval": 1000,
         "exponential_backoff": {"enabled": False, "multiplier": 2, "max_interval": 10000}}

CRM_ENV = {"id": "6c1b3f0a-2d4e-4f6a-8b9c-1d2e3f4a5b6c", "name": "CRM_BASE_URL",
           "value": "http://host.docker.internal:8090", "value_type": "string",
           "description": "Mock CRM; replace with your CRM base URL"}

FEATURES = {"file_upload": {"enabled": False}, "opening_statement": "", "retriever_resource": {"enabled": False},
            "sensitive_word_avoidance": {"enabled": False}, "speech_to_text": {"enabled": False},
            "suggested_questions": [], "suggested_questions_after_answer": {"enabled": False},
            "text_to_speech": {"enabled": False, "language": "", "voice": ""}}


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


def llm_node(id_, x, y, title, system, user, temperature=0.3, memory=None):
    return node(id_, x, y, {
        "title": title, "type": "llm",
        "model": {"provider": PROVIDER, "name": MODEL, "mode": "chat", "completion_params": {"temperature": temperature}},
        "prompt_template": [{"role": "system", "text": system}, {"role": "user", "text": user}],
        "vision": {"enabled": False}, "memory": memory,
        "context": {"enabled": False, "variable_selector": []},
        "structured_output_enabled": False, "retry_config": RETRY}, h=118)


def crm_history_node(id_, x, y, email_ref):
    return node(id_, x, y, {
        "title": "CRM history", "type": "http-request",
        "method": "get", "url": "{{#env.CRM_BASE_URL#}}/crm/history",
        "authorization": {"type": "no-auth"}, "headers": "",
        "params": "email:" + email_ref,
        "body": {"type": "none", "data": []},
        "timeout": {"connect": 10, "read": 30, "write": 30}, "retry_config": RETRY})


def lines(*parts):
    return "\n".join(parts)


def emit(app, nodes, edges, mode_features=None, viewport=None):
    dsl = {
        "app": app, "kind": "app", "version": "0.6.0", "dependencies": [],
        "workflow": {
            "conversation_variables": [],
            "environment_variables": [CRM_ENV],
            "features": mode_features or FEATURES,
            "graph": {"edges": edges, "nodes": nodes, "viewport": viewport or {"x": 0, "y": 0, "zoom": 0.7}},
            "rag_pipeline_variables": [],
        },
    }
    sys.stdout.write(yaml.safe_dump(dsl, allow_unicode=True, sort_keys=False))
