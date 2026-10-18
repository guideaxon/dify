# Customizing the CRM Workflows in the Dify Canvas

How to add, remove and change steps, and decide which steps need human approval (HITL), using Dify's own workflow editor. No code changes are needed. Background and architecture are in `designAgenticCRM.md`; sales context is in `sales101.md`.

Button and node names below come from this repo's English UI strings (Add Node, Human Input, IF/ELSE, HTTP Request, Output, Test Run, Publish). Menus may differ slightly in your build.

## 1. Starting templates

Import any of these with **Studio, Create from DSL file** (files live in `docker/crm-local/`):

| Template | What it does | Approval |
|---|---|---|
| `agentic_crm_phase1.yml` | Lead inquiry, LLM draft, human review, CRM write | Yes, before the write |
| `agentic_crm_precall_brief.yml` | CRM history, LLM brief | None (read-only) |

Always **duplicate an app before editing it**, so you keep a working original. Imported apps may need the model re-selected in each LLM node, and the `CRM_BASE_URL` environment variable changed to your CRM.

## 2. Everyday edits

**Add a step.** Hover an edge between two nodes and click the **+**, or drag from a node's right-hand handle and choose a block. Common additions: LLM, HTTP Request, Knowledge Retrieval, IF/ELSE, Code. After adding, open the node, fill it in, and make sure its inputs reference earlier outputs by selecting them from the variable picker.

**Remove a step.** Select the node and delete it, then reconnect the neighbors by dragging from the previous node's handle to the next node. Check any later node that referenced the deleted node's outputs. Dify flags missing references on the checklist before you can publish.

**Modify a step.** Click the node to open its panel. For an LLM node you can change the model, system prompt and user prompt. For HTTP Request you can change the URL, headers and body. Use **Test Run** with a sample input to try the whole flow, or run a single node to test just that step. Inspect intermediate values in the variable inspector.

**Rewire or reorder.** Drag edges to new targets. A node can feed several nodes, and several nodes can feed one.

**Publish.** Changes live in a draft until you publish. Test first, then **Publish**.

## 3. Requiring approval for a step

Dify has no per-step "needs approval" checkbox. You add a **Human Input** node in front of the step you want to gate.

1. Click **+** on the edge just before the step, and add **Human Input**.
2. **Form content:** write what the reviewer should see. Show the thing being approved, for example the draft reply. Fields you want them to edit go in as inputs, and a field's default can be set to an earlier node's output so the draft appears pre-filled and editable.
3. **User actions:** add buttons such as *Approve* and *Reject*. **Each button becomes its own output edge.** The node needs at least one action.
4. **Delivery:** enable at least one method (web app form is enough locally). The panel won't validate without one.
5. **Timeout:** choose hours or days. The node also gets a separate timeout edge.
6. **Wire every edge:**
   - *Approve* leads to the gated step.
   - *Reject* leads to an end node (or a "log and stop" branch).
   - *Timeout* leads to an end node. Without this, an unreviewed run ends with no outcome.
7. Downstream steps should use the edited value (the Human Input output), not the original LLM output, or the reviewer's edits are ignored.

**To remove approval:** delete the Human Input node, delete its Reject and timeout branches, and connect the previous step straight to the gated step.

### Which steps should get a gate

| Step | Gate? |
|---|---|
| First outreach to a new contact | Yes |
| Any price, discount or contract commitment | Yes |
| Create or change a deal, or change its stage, in the CRM | Yes |
| Replies about negotiation or legal terms | Yes |
| Research, summaries, scoring, internal notes | Usually no |
| Read-only lookups | No |

Treat a gate as removable only once its approval rate is consistently high and edits are rare.

## 4. Conditional approval (gate only when needed)

Often the rule depends on the data, such as "discount above 10%" or "contact is an executive".

1. Before the step, add an **IF/ELSE** node with the condition.
2. On the **IF** branch, route through a Human Input node, then to the step.
3. On the **ELSE** branch, go straight to the step.
4. If the step needs a value that only the approval branch edits, merge the two values first with a variable aggregator-type node (check its exact name in your **Add Node** list), so the later step reads one variable regardless of the path taken.

## 5. Guardrails

- **Rules belong in nodes, not prompts.** Put hard limits (discount caps, allowed recipients) in IF/ELSE or Code nodes. An LLM prompt can be talked around.
- **Make writes safe to repeat.** Keep an idempotency key or upsert-by-ID on any CRM write so a re-run doesn't duplicate records.
- **Never gate-less on writes.** Don't connect an LLM node straight to a CRM write. At least one approval or rule check stands between them.
- **Cap loops.** Any retry, nurture or iteration needs a maximum count and an opt-out check.

## 6. Before you publish an edited workflow

- [ ] Every Human Input node has Approve, Reject and timeout edges wired.
- [ ] Every CRM write sits behind an approval or a rule check.
- [ ] Test Run with an approve path, a reject path and (if you can) a timeout path.
- [ ] Downstream steps reference the reviewed value.
- [ ] No node still points at a deleted step's outputs.
- [ ] Prompts use only the data provided and say what to do when something is unknown.
- [ ] You exported the DSL (or duplicated the app) as a backup.

## 7. Limits of this approach

This keeps you on the stock canvas, so reviewers see plain text forms and each approval gate is built by hand. Not available here: a one-click approval toggle per step, a rules table editor, a visual diff of proposed CRM changes, and a cross-workflow approval inbox. These are in the roadmap in `designAgenticCRM.md`. If hand-wiring gates becomes the bottleneck, the next step is a thin stage-level editor that inserts and removes gates for you.
