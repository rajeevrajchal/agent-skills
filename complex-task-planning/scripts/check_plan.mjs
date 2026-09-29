#!/usr/bin/env node
// Validate a JSON task plan: structure, dependencies, cycles, parallel waves, coverage.
// Usage: node scripts/check_plan.mjs plan.json [--json]
// Exit codes: 0 = valid (warnings allowed), 1 = errors found, 2 = usage / unreadable input.
// No dependencies. Node 18+. See assets/plan-template.md for the format.

import { readFileSync } from "node:fs";

const VALID_KINDS = new Set(["discover", "act", "check"]);
const MAX_REASONABLE_TASKS = 15;

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const target = args.find((a) => !a.startsWith("--"));
if (!target) { console.error("usage: check_plan.mjs plan.json [--json]"); process.exit(2); }

let plan;
try {
  plan = JSON.parse(readFileSync(target, "utf8"));
} catch (e) {
  if (e.code === "ENOENT") { console.error(`error: File not found: ${target}`); process.exit(2); }
  const pos = e.message.match(/position (\d+)/);
  if (pos) {
    const src = (() => { try { return readFileSync(target, "utf8"); } catch { return ""; } })();
    const offset = Number(pos[1]);
    let line = 1, col = 1;
    for (let i = 0; i < offset && i < src.length; i++) {
      if (src[i] === "\n") { line++; col = 1; } else col++;
    }
    console.error(`error: Invalid JSON in ${target}: line ${line} col ${col}: ${e.message}`);
  } else {
    console.error(`error: Invalid JSON in ${target}: ${e.message}`);
  }
  process.exit(2);
}
if (typeof plan !== "object" || plan === null || Array.isArray(plan)) {
  console.error("error: Top level must be a JSON object with 'objective', 'success_criteria', 'tasks'.");
  process.exit(2);
}

function findCycle(graph) {
  const WHITE = 0, GREY = 1, BLACK = 2;
  const color = {};
  for (const n of Object.keys(graph)) color[n] = WHITE;
  const stack = [];

  function visit(node) {
    color[node] = GREY;
    stack.push(node);
    for (const dep of (graph[node] || [])) {
      if (!(dep in color)) continue;
      if (color[dep] === GREY) return [...stack.slice(stack.indexOf(dep)), dep];
      if (color[dep] === WHITE) {
        const found = visit(dep);
        if (found.length) return found;
      }
    }
    stack.pop();
    color[node] = BLACK;
    return [];
  }

  for (const n of Object.keys(graph)) {
    if (color[n] === WHITE) {
      const cyc = visit(n);
      if (cyc.length) return cyc;
    }
  }
  return [];
}

function waves(graph) {
  const remaining = {};
  for (const [n, deps] of Object.entries(graph)) {
    remaining[n] = new Set(deps.filter((d) => d in graph));
  }
  const done = new Set();
  const result = [];
  while (Object.keys(remaining).length) {
    const ready = Object.keys(remaining)
      .filter((n) => [...remaining[n]].every((d) => done.has(d)))
      .sort();
    if (!ready.length) break; // cycle; reported separately
    result.push(ready);
    for (const n of ready) { done.add(n); delete remaining[n]; }
  }
  return result;
}

function check(plan) {
  const errors = [];
  const warnings = [];

  const objective = plan.objective;
  if (typeof objective !== "string" || !objective.trim()) {
    errors.push("Missing 'objective' (one sentence describing the outcome).");
  }

  let criteria = plan.success_criteria ?? [];
  if (!Array.isArray(criteria) || !criteria.length) {
    warnings.push("No 'success_criteria'. Validation will have nothing concrete to check against.");
    criteria = [];
  }
  const criteriaIds = new Set(
    criteria
      .filter((c) => typeof c === "string" && c.includes(":"))
      .map((c) => String(c).split(":")[0].trim())
  );

  const tasks = plan.tasks;
  if (!Array.isArray(tasks) || !tasks.length) {
    errors.push("Missing or empty 'tasks' list.");
    return { errors, warnings, waves: [] };
  }

  const graph = {};
  const byId = {};
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const where = `tasks[${i}]`;
    if (typeof t !== "object" || t === null || Array.isArray(t)) {
      errors.push(`${where}: must be an object.`);
      continue;
    }
    const tid = t.id;
    if (typeof tid !== "string" || !tid.trim()) {
      errors.push(`${where}: missing 'id'.`);
      continue;
    }
    if (tid in byId) {
      errors.push(`Duplicate task id '${tid}'.`);
      continue;
    }
    if (!String(t.task ?? "").trim()) {
      errors.push(`${tid}: missing 'task' description.`);
    }
    let deps = t.depends_on ?? [];
    if (!Array.isArray(deps) || !deps.every((d) => typeof d === "string")) {
      errors.push(`${tid}: 'depends_on' must be a list of task ids.`);
      deps = [];
    }
    if (deps.includes(tid)) {
      errors.push(`${tid}: depends on itself.`);
    }
    const kind = t.kind;
    if (kind != null && !VALID_KINDS.has(kind)) {
      errors.push(`${tid}: kind '${kind}' must be one of [${[...VALID_KINDS].sort().map((k) => `'${k}'`).join(", ")}].`);
    }
    if (!String(t.check ?? "").trim()) {
      warnings.push(`${tid}: no 'check'. How will you know it succeeded?`);
    }
    if (!String(t.produces ?? "").trim() && kind !== "check") {
      warnings.push(`${tid}: no 'produces'. Name the output the next task consumes.`);
    }
    if (t.irreversible && !deps.some(
      (d) => tasks.some((t2) => typeof t2 === "object" && t2 !== null && t2.id === d && t2.checkpoint)
    ) && !t.checkpoint) {
      warnings.push(`${tid}: irreversible but no checkpoint on it or its dependencies. Add a user-approval checkpoint.`);
    }
    for (const c of (t.criteria || [])) {
      if (criteriaIds.size && !criteriaIds.has(c)) {
        warnings.push(`${tid}: references unknown success criterion '${c}'.`);
      }
    }
    graph[tid] = deps;
    byId[tid] = t;
  }

  for (const [tid, deps] of Object.entries(graph)) {
    for (const d of deps) {
      if (!(d in graph)) {
        errors.push(`${tid}: depends on unknown task '${d}'.`);
      }
    }
  }

  const cycle = findCycle(graph);
  if (cycle.length) {
    errors.push("Dependency cycle: " + cycle.join(" -> "));
  }

  // Ordering heuristics
  for (const [tid, t] of Object.entries(byId)) {
    if (t.kind === "discover") {
      for (const d of graph[tid]) {
        if (byId[d] && byId[d].kind === "act") {
          warnings.push(`${tid}: discovery task depends on action task '${d}'. Can discovery run earlier?`);
        }
      }
    }
  }

  if (Object.keys(byId).length > MAX_REASONABLE_TASKS) {
    warnings.push(
      `${Object.keys(byId).length} tasks. Check for over-decomposition; leaves should be one action with one check.`
    );
  }
  if (!Object.values(byId).some((t) => t.kind === "check")) {
    warnings.push("No task of kind 'check'. Add a final validation task against the success criteria.");
  }

  if (criteriaIds.size) {
    const covered = new Set();
    for (const t of Object.values(byId)) {
      for (const c of (t.criteria || [])) covered.add(c);
    }
    const missing = [...criteriaIds].filter((c) => !covered.has(c)).sort();
    if (covered.size && missing.length) {
      warnings.push("Success criteria not covered by any task: " + missing.join(", "));
    }
  }

  return { errors, warnings, waves: cycle.length ? [] : waves(graph) };
}

const report = check(plan);

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const e of report.errors)   console.log(`ERROR   ${e}`);
  for (const w of report.warnings) console.log(`WARNING ${w}`);
  if (report.waves.length) {
    console.log("\nExecution waves (tasks in a wave can run in parallel):");
    report.waves.forEach((wave, i) => console.log(`  Wave ${i + 1}: ${wave.join(", ")}`));
  }
  const status = report.errors.length ? "INVALID" : "OK";
  console.log(`\n${status}: ${report.errors.length} error(s), ${report.warnings.length} warning(s).`);
}

process.exit(report.errors.length ? 1 : 0);
