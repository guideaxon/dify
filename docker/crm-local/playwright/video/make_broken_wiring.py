"""Writes a copy of the Phase 1 workflow with ONE edge removed (draft -> review), for the
"deliberately broken wiring" scene. Run inside the api container (needs PyYAML), feeding the original file on stdin:
  docker cp make_broken_wiring.py docker-api-1:/tmp/g/
  docker exec -i docker-api-1 python /tmp/g/make_broken_wiring.py < ../../agentic_crm_phase1.yml > broken.yml
Reads the original YAML on stdin and writes the modified YAML to stdout.
"""
import sys

import yaml

dsl = yaml.safe_load(sys.stdin.read())
dsl["app"]["name"] = "DEMO broken wiring"
edges = dsl["workflow"]["graph"]["edges"]
dsl["workflow"]["graph"]["edges"] = [e for e in edges if not (e["source"] == "draft" and e["target"] == "review")]
assert len(dsl["workflow"]["graph"]["edges"]) == len(edges) - 1
sys.stdout.write(yaml.safe_dump(dsl, allow_unicode=True, sort_keys=False))
