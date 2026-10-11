#!/usr/bin/env node
// @ts-check
/**
 * Score, gate, classify, and rank startup ideas from a JSON ledger.
 *
 * Implements the rules in references/scoring-rubric.md:
 *   - 12 weighted criteria (higher = better), weights summing to 100
 *   - gates G1–G5 (pass / fail / unknown)
 *   - evidence levels per criterion (assumption / research / conversations / behavioral)
 *   - verdicts: Reject / Needs validation / Interesting but risky / Strong prototype candidate / Strong business opportunity
 *   - warnings (no competitors, weak pain, no distribution, copyable advantage, possible duplicates)
 *
 * Usage:
 *   node scripts/score-ideas.mjs ledger.json [--json] [--md report.md]
 *
 * No dependencies. Node 18+. Exit 0 on success, 1 if the ledger has errors, 2 on usage errors.
 */
import { readFileSync, writeFileSync } from "node:fs";

/** @typedef {"pass" | "fail" | "unknown"} GateStatus */
/** @typedef {"reject" | "validate" | "risky" | "prototype" | "build" | "incomplete"} VerdictKey */
/**
 * @typedef {object} ScoreEntry
 * @property {number} score
 * @property {string} [evidence]
 * @property {string} [note]
 */
/**
 * @typedef {object} Idea
 * @property {string} id
 * @property {string} [title]
 * @property {string} [problem]
 * @property {string} [target_user]
 * @property {string[]} [competitors]
 * @property {string | null} [merged_into]
 * @property {Record<string, string>} [gates]
 * @property {Record<string, ScoreEntry>} [scores]
 */
/**
 * @typedef {object} Result
 * @property {string} id
 * @property {string} title
 * @property {number | null} score
 * @property {"Low" | "Medium" | "High" | null} confidence
 * @property {string} verdict
 * @property {VerdictKey} verdict_key
 * @property {string} recommendation
 * @property {string} reason
 * @property {Record<string, string>} gates
 * @property {string[]} warnings
 * @property {string[]} errors
 */

/** @type {ReadonlyArray<readonly [key: string, label: string, weight: number]>} */
const CRITERIA = [
  ["severity", "Problem severity", 12],
  ["frequency", "Frequency", 8],
  ["willingness_to_pay", "Willingness to pay", 12],
  ["market_sufficiency", "Market sufficiency", 8],
  ["competitive_openness", "Competitive openness", 6],
  ["differentiation", "Differentiation", 8],
  ["reachability", "Reachability", 12],
  ["build_feasibility", "Build feasibility", 8],
  ["time_to_mvp", "Time to MVP", 6],
  ["retention", "Retention", 8],
  ["monetization", "Monetization", 6],
  ["defensibility", "Defensibility", 6],
];
const KEY_CRITERIA = new Set(["severity", "willingness_to_pay", "reachability"]);
/** @type {Record<string, number>} */
const EVIDENCE = { assumption: 0, research: 1, conversations: 2, behavioral: 3 };
const GATES = ["G1", "G2", "G3", "G4", "G5"];
/** @type {Record<string, string>} */
const GATE_NAMES = {
  G1: "real specific problem",
  G2: "reachable buyers",
  G3: "someone pays",
  G4: "feasible for founder",
  G5: "legal/platform risk",
};
/** @type {Record<VerdictKey, string>} */
const VERDICTS = {
  reject: "❌ Reject",
  validate: "⚠️ Needs validation",
  risky: "🟡 Interesting but risky",
  prototype: "🟢 Strong prototype candidate",
  build: "🔥 Strong business opportunity",
  incomplete: "… Incomplete",
};
/** @type {Record<VerdictKey, string>} */
const RECOMMENDATION = {
  reject: "Reject",
  validate: "Validate",
  risky: "Validate",
  prototype: "Prototype",
  build: "Build",
  incomplete: "Score it",
};
const STOPWORDS = new Set(
  ("a an the and or for to of in on with who that their they them is are be by as at from it this " +
    "spend spends hours time people users need needs make making").split(" "),
);

/** @param {string} msg @returns {never} */
function failUsage(msg) {
  console.error(`error: ${msg}`);
  process.exit(2);
}

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/** @param {string} text @returns {Set<string>} */
function tokens(text) {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(words.filter((w) => w.length > 2 && !STOPWORDS.has(w)));
}

/** @param {Set<string>} a @param {Set<string>} b */
function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

/** @param {number} n */
const fmt0 = (n) => n.toFixed(0);

/** @param {Record<string, unknown>} ledger @param {string[]} errors @returns {Record<string, number>} */
function loadWeights(ledger, errors) {
  /** @type {Record<string, number>} */
  const weights = Object.fromEntries(CRITERIA.map(([k, , w]) => [k, w]));
  const override = ledger.weights;
  if (isObject(override)) {
    for (const [k, v] of Object.entries(override)) {
      if (!(k in weights)) errors.push(`weights: unknown criterion '${k}'.`);
      else if (typeof v !== "number" || v < 0) errors.push(`weights: '${k}' must be a non-negative number.`);
      else weights[k] = v;
    }
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(total - 100) > 0.01) errors.push(`weights must sum to 100 (got ${total}).`);
  }
  return weights;
}

/** @param {Idea} idea @param {Record<string, number>} weights @returns {Result} */
function evaluate(idea, weights) {
  const id = String(idea.id ?? "?");
  /** @type {string[]} */ const problems = [];
  /** @type {string[]} */ const warnings = [];

  const gatesIn = isObject(idea.gates) ? idea.gates : {};
  /** @type {Record<string, string>} */
  const gates = Object.fromEntries(GATES.map((g) => [g, String(gatesIn[g] ?? "unknown").toLowerCase()]));
  for (const [g, s] of Object.entries(gates)) {
    if (!["pass", "fail", "unknown"].includes(s)) problems.push(`${g} must be pass/fail/unknown (got '${s}').`);
  }
  const failed = GATES.filter((g) => gates[g] === "fail");
  const unknown = GATES.filter((g) => gates[g] === "unknown");

  const scoresIn = isObject(idea.scores) ? idea.scores : {};
  /** @type {Record<string, number>} */ const scores = {};
  /** @type {Record<string, number>} */ const evidence = {};
  for (const [key, label] of CRITERIA) {
    const entry = scoresIn[key];
    if (entry === undefined || entry === null) continue;
    if (!isObject(entry)) {
      problems.push(`scores.${key} must be an object with score/evidence.`);
      continue;
    }
    const s = entry.score;
    if (typeof s !== "number" || !Number.isFinite(s) || s < 1 || s > 10) {
      problems.push(`scores.${key}.score must be 1-10.`);
      continue;
    }
    let ev = String(entry.evidence ?? "assumption").toLowerCase();
    if (!(ev in EVIDENCE)) {
      problems.push(`scores.${key}.evidence must be one of ${Object.keys(EVIDENCE).sort().join(", ")}.`);
      ev = "assumption";
    }
    if (!String(entry.note ?? "").trim()) warnings.push(`${label}: no justification note.`);
    scores[key] = Math.round(s);
    evidence[key] = EVIDENCE[ev];
  }

  const complete = Object.keys(scores).length === CRITERIA.length;
  /** @type {number | null} */ let total = null;
  /** @type {Result["confidence"]} */ let confidence = null;
  if (complete) {
    total = Math.round(CRITERIA.reduce((sum, [k]) => sum + (weights[k] * scores[k]) / 10, 0) * 10) / 10;
    const conf = CRITERIA.reduce((sum, [k]) => sum + weights[k] * evidence[k], 0) / 100;
    confidence = conf < 0.75 ? "Low" : conf <= 1.5 ? "Medium" : "High";
  }

  // Verdict rules (order matters)
  /** @type {VerdictKey} */ let verdict;
  let reason = "";
  const hasCompetitors = Array.isArray(idea.competitors) && idea.competitors.length > 0;
  if (failed.length) {
    verdict = "reject";
    reason = "Failed gate(s): " + failed.map((g) => `${g} (${GATE_NAMES[g]})`).join(", ");
  } else if (idea.merged_into) {
    verdict = "reject";
    reason = `Merged into ${idea.merged_into}`;
  } else if (!complete || total === null) {
    verdict = "incomplete";
    const missing = CRITERIA.filter(([k]) => !(k in scores)).length;
    reason = `${missing} criteria unscored`;
  } else if (total < 45) {
    verdict = "reject";
    reason = `Score ${fmt0(total)} < 45`;
  } else if (unknown.length || CRITERIA.some(([k]) => KEY_CRITERIA.has(k) && evidence[k] === 0)) {
    verdict = "validate";
    const parts = [];
    if (unknown.length) parts.push("unknown gate(s): " + unknown.join(", "));
    const weak = CRITERIA.filter(([k]) => KEY_CRITERIA.has(k) && evidence[k] === 0).map(([, label]) => label);
    if (weak.length) parts.push("assumption-only: " + weak.join(", "));
    reason = parts.join("; ");
  } else if (total < 65) {
    verdict = "risky";
    reason = `Score ${fmt0(total)} in 45-64`;
  } else if (scores.reachability <= 4) {
    verdict = "risky";
    reason = `Score ${fmt0(total)}, but no clear distribution path (reachability ${scores.reachability}/10)`;
  } else if (scores.competitive_openness >= 9 && !hasCompetitors) {
    verdict = "risky";
    reason = `Score ${fmt0(total)}, but no competitors found: demand unproven`;
  } else if (total >= 75 && evidence.willingness_to_pay >= 3 && evidence.reachability >= 2) {
    verdict = "build";
    reason = "High score with behavioral willingness to pay and a validated channel";
  } else {
    verdict = "prototype";
    reason = `Score ${fmt0(total)} ≥ 65, gates pass`;
    if (total >= 75) reason += " (🔥 needs behavioral WTP + validated channel)";
  }

  if (complete && total !== null) {
    if (scores.competitive_openness >= 9 && !hasCompetitors)
      warnings.push("No competitors listed but openness ≥ 9: verify demand exists.");
    if (scores.severity <= 4 && total >= 55) warnings.push("Weak pain inflated by other criteria.");
    if (scores.reachability <= 4) warnings.push("No clear distribution path (reachability ≤ 4).");
    if (scores.defensibility <= 3 && scores.differentiation >= 7)
      warnings.push("Differentiation likely copyable (defensibility ≤ 3).");
  }
  if (!idea.problem) warnings.push("No problem statement.");
  if (!idea.target_user) warnings.push("No target user.");

  return {
    id,
    title: String(idea.title ?? ""),
    score: total,
    confidence,
    verdict: VERDICTS[verdict],
    verdict_key: verdict,
    recommendation: RECOMMENDATION[verdict],
    reason,
    gates,
    warnings,
    errors: problems,
  };
}

/** @param {Idea[]} ideas @returns {Array<[string, string, number]>} */
function findDuplicates(ideas) {
  /** @type {Array<[string, string, number]>} */ const pairs = [];
  const toks = ideas.map((i) => ({
    id: String(i.id),
    set: tokens(`${i.problem ?? ""} ${i.target_user ?? ""}`),
    merged: i.merged_into ?? null,
  }));
  for (let a = 0; a < toks.length; a++) {
    for (let b = a + 1; b < toks.length; b++) {
      const A = toks[a];
      const B = toks[b];
      if (A.merged === B.id || B.merged === A.id) continue; // already merged
      const sim = jaccard(A.set, B.set);
      if (sim >= 0.45) pairs.push([A.id, B.id, Math.round(sim * 100) / 100]);
    }
  }
  return pairs;
}

/** @param {Result[]} results @param {Array<[string, string, number]>} dups */
function renderMarkdown(results, dups) {
  // Validate and risky share a tier, ranked by score: both need evidence before building.
  /** @type {Record<VerdictKey, number>} */
  const order = { build: 0, prototype: 1, risky: 2, validate: 2, incomplete: 3, reject: 4 };
  const ranked = [...results].sort(
    (x, y) => order[x.verdict_key] - order[y.verdict_key] || (y.score ?? 0) - (x.score ?? 0),
  );
  const out = [
    "| Rank | ID | Idea | Score | Confidence | Verdict | Recommendation | Why |",
    "|---|---|---|---|---|---|---|---|",
  ];
  ranked.forEach((r, i) => {
    const score = r.score === null ? "—" : `${fmt0(r.score)}/100`;
    out.push(
      `| ${i + 1} | ${r.id} | ${r.title} | ${score} | ${r.confidence ?? "—"} | ${r.verdict} | ${r.recommendation} | ${r.reason} |`,
    );
  });
  const notes = [];
  for (const r of ranked) {
    const items = [...r.errors.map((e) => `ERROR: ${e}`), ...r.warnings];
    if (items.length) notes.push(`- **${r.id}**: ${items.join(" · ")}`);
  }
  if (dups.length) {
    notes.push(
      "- **Possible duplicates** (consider merging): " +
        dups.map(([a, b, s]) => `${a} ↔ ${b} (similarity ${s})`).join(", "),
    );
  }
  if (notes.length) out.push("", "**Flags**", ...notes);
  const survivors = ranked.filter((r) => r.verdict_key === "build" || r.verdict_key === "prototype");
  if (survivors.length > 3) {
    out.push(
      "",
      `⚠️ ${survivors.length} ideas at Prototype/Build. Narrow to at most 3 by founder fit and cheapest validation.`,
    );
  }
  return out.join("\n");
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes("--json");
  let mdPath = null;
  const mdIdx = argv.indexOf("--md");
  if (mdIdx !== -1) {
    mdPath = argv[mdIdx + 1];
    if (!mdPath || mdPath.startsWith("--")) failUsage("--md needs a file path");
  }
  const positional = argv.filter((a, i) => !a.startsWith("--") && !(mdIdx !== -1 && i === mdIdx + 1));
  if (positional.length !== 1) failUsage("usage: score-ideas.mjs ledger.json [--json] [--md report.md]");

  /** @type {unknown} */ let ledger;
  try {
    ledger = JSON.parse(readFileSync(positional[0], "utf8"));
  } catch (err) {
    const e = /** @type {NodeJS.ErrnoException} */ (err);
    if (e.code === "ENOENT") failUsage(`file not found: ${positional[0]}`);
    failUsage(`invalid JSON: ${e.message}`);
  }
  if (!isObject(ledger) || !Array.isArray(ledger.ideas) || ledger.ideas.length === 0) {
    failUsage("ledger needs a non-empty 'ideas' list");
  }

  /** @type {string[]} */ const errors = [];
  const weights = loadWeights(ledger, errors);
  const ideas = /** @type {Idea[]} */ (ledger.ideas.filter(isObject));
  const ids = ideas.map((i) => String(i.id));
  for (const dup of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) errors.push(`duplicate idea id '${dup}'.`);

  const results = ideas.map((i) => evaluate(i, weights));
  for (const [i, r] of results.entries()) {
    const merged = ideas[i].merged_into;
    if (merged && !ids.includes(merged)) r.errors.push(`merged_into '${merged}' not found.`);
  }
  const dups = findDuplicates(ideas);
  const hasErrors = errors.length > 0 || results.some((r) => r.errors.length > 0);

  if (asJson) {
    console.log(
      JSON.stringify(
        { errors, results, possible_duplicates: dups.map(([a, b, similarity]) => ({ a, b, similarity })) },
        null,
        2,
      ),
    );
  } else {
    for (const e of errors) console.log(`ERROR ${e}`);
    const md = renderMarkdown(results, dups);
    console.log(md);
    if (mdPath) {
      writeFileSync(mdPath, md + "\n", "utf8");
      console.log(`\nWrote ${mdPath}`);
    }
  }
  process.exitCode = hasErrors ? 1 : 0;
}

main();
