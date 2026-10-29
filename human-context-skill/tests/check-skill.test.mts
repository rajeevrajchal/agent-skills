/**
 * Mechanical checks for the human-context skill (deterministic; no model calls).
 *
 *   1. Frontmatter and naming rules from the Agent Skills specification
 *   2. Size and progressive-disclosure limits
 *   3. Relative links resolve; scripts/ is dependency-free
 *   4. Evaluation suite is complete (33 scenarios); runnable cases are well formed
 *   5. vault-graph (library and built CLI) gives expected results on the fixtures
 *   6. Fixture properties the evaluation scenarios depend on
 *
 * These do NOT test model behavior. See human-context/references/evaluation.md.
 * Run: npm test
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  backlinks,
  buildGraph,
  extractLinks,
  frontmatterKeyCounts,
  localGraph,
  obsidianConfig,
  orphans,
  parseFrontmatter,
  run,
  unresolved,
} from "../src/vault-graph.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const SKILL = join(ROOT, "human-context");
const VAULT = join(HERE, "fixtures", "vault");
const EDGE_VAULT = join(HERE, "fixtures", "edge-vault");
const BUILT_CLI = join(SKILL, "scripts", "vault-graph.mjs");

const read = (p: string): string => readFileSync(p, "utf8");
const skillMd = read(join(SKILL, "SKILL.md"));

/** Minimal parser for the flat frontmatter this skill uses (no YAML dependency). */
function parseSkillFrontmatter(text: string): { fields: Record<string, string>; metadata: Record<string, string>; end: number } {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(m, "SKILL.md must start with YAML frontmatter");
  const fields: Record<string, string> = {};
  const metadata: Record<string, string> = {};
  let inMeta = false;
  for (const line of m[1].split("\n")) {
    const top = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (top) {
      inMeta = top[1] === "metadata";
      fields[top[1]] = top[2].replace(/^(["'])(.*)\1$/, "$2");
      continue;
    }
    const nested = /^\s+([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (inMeta && nested) metadata[nested[1]] = nested[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return { fields, metadata, end: m[0].length };
}

const fm = parseSkillFrontmatter(skillMd);

// ---------- 1. frontmatter ----------
test("frontmatter: name follows the specification", () => {
  const name = fm.fields.name;
  assert.ok(name && name.length >= 1 && name.length <= 64, "1-64 chars");
  assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase alphanumerics and single hyphens, none at the ends");
  assert.equal(name, basename(SKILL), "name must match the directory name");
});

test("frontmatter: description is non-empty, <=1024 chars, says what and when", () => {
  const d = fm.fields.description;
  assert.ok(d.length >= 1 && d.length <= 1024, `${d.length} chars`);
  assert.match(d, /Use when/);
  assert.match(d, /Skip for/);
});

test("frontmatter: only known keys; metadata values are strings", () => {
  const allowed = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
  for (const k of Object.keys(fm.fields)) assert.ok(allowed.has(k), `unknown key ${k}`);
  if (fm.fields.compatibility) assert.ok(fm.fields.compatibility.length <= 500);
  for (const v of Object.values(fm.metadata)) assert.equal(typeof v, "string");
});

// ---------- 2. size ----------
test("size: SKILL.md under 500 lines and ~5000 tokens", () => {
  const lines = skillMd.split("\n").length;
  const approxTokens = Math.round(skillMd.slice(fm.end).split(/\s+/).length * 1.35);
  assert.ok(lines < 500, `${lines} lines`);
  assert.ok(approxTokens < 5000, `~${approxTokens} tokens`);
});

test("size: each reference file stays focused (<500 lines)", () => {
  for (const f of readdirSync(join(SKILL, "references"))) {
    const n = read(join(SKILL, "references", f)).split("\n").length;
    assert.ok(n < 500, `${f}: ${n} lines`);
  }
});

// ---------- 3. links and scripts ----------
test("links: every relative link in SKILL.md, README, references resolves", () => {
  const files = [join(SKILL, "SKILL.md"), join(SKILL, "README.md")].concat(
    readdirSync(join(SKILL, "references")).map((f) => join(SKILL, "references", f)),
  );
  const broken: string[] = [];
  for (const p of files) {
    const text = read(p).replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
    for (const m of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:)/.test(target)) continue;
      if (!existsSync(normalize(join(dirname(p), target)))) broken.push(`${relative(SKILL, p)} -> ${target}`);
    }
  }
  assert.deepEqual(broken, []);
});

test("links: every reference file is linked from SKILL.md", () => {
  const linked = new Set([...skillMd.matchAll(/references\/([a-z-]+\.md)/g)].map((m) => m[1]));
  for (const f of readdirSync(join(SKILL, "references"))) assert.ok(linked.has(f), `${f} not linked`);
});

test("hygiene: no placeholder text in SKILL.md", () => {
  assert.doesNotMatch(skillMd, /TODO|FIXME|lorem ipsum/i);
});

test("scripts: skill ships exactly one built script, with only node: imports", () => {
  const dir = join(SKILL, "scripts");
  assert.deepEqual(readdirSync(dir), ["vault-graph.mjs"]);
  const imports = [...read(BUILT_CLI).matchAll(/^import .* from ["']([^"']+)["'];?$/gm)].map((m) => m[1]);
  assert.ok(imports.length > 0);
  for (const i of imports) assert.match(i, /^node:/, `non-builtin import: ${i}`);
});

test("scripts: built output is in sync with src/vault-graph.mts", () => {
  // `npm test` rebuilds first; this guards against running the test file directly with a stale build.
  assert.ok(statSync(BUILT_CLI).mtimeMs >= statSync(join(ROOT, "src", "vault-graph.mts")).mtimeMs - 1000, "run `npm run build`");
});

// ---------- 4. evaluation suite ----------
const evalDoc = read(join(SKILL, "references", "evaluation.md"));

test("evaluation.md: scenarios 1..33 in order, each with all five fields", () => {
  const nums = [...evalDoc.matchAll(/^### (\d+)\. /gm)].map((m) => Number(m[1]));
  assert.deepEqual(nums, Array.from({ length: 33 }, (_, i) => i + 1));
  const blocks = evalDoc.split(/^### \d+\. /m).slice(1);
  const fields = ["**Setup:**", "**Expected:**", "**Success:**", "**Avoid:**", "**Test:**"];
  const missing = blocks.flatMap((b, i) => (fields.every((f) => b.includes(f)) ? [] : [i + 1]));
  assert.deepEqual(missing, []);
});

test("evals: runnable cases are well formed and referenced in evaluation.md", () => {
  const dir = join(SKILL, "evals");
  const cases = readdirSync(dir).sort();
  assert.ok(cases.length >= 14, `${cases.length} cases`);
  const allowedSettings = new Set(["tags", "max_turns", "timeout_seconds", "allowed_tools"]);
  const reserved = new Set(["results", "mocks", "node_modules", "files", "true", "false", "null"]);
  const problems: string[] = [];
  for (const c of cases) {
    const d = join(dir, c);
    if (!/^[a-z][a-z0-9-]*$/.test(c) || reserved.has(c)) problems.push(`${c}: bad name`);
    const prompt = read(join(d, "prompt.md"));
    const pm = /^---\n([\s\S]*?)\n---\n/.exec(prompt);
    if (!pm) { problems.push(`${c}: prompt.md settings block`); continue; }
    for (const line of pm[1].split("\n")) {
      const key = line.split(":")[0];
      if (!allowedSettings.has(key)) problems.push(`${c}: unknown setting ${key}`);
    }
    const yaml = read(join(d, "case.yaml"));
    if (!yaml.includes('schema_version: "1.1"') || !yaml.includes(`name: ${c}`) || !yaml.includes("expected_outcome: |")) {
      problems.push(`${c}: case.yaml fields`);
    }
    const gdir = join(d, "graders");
    const graders = existsSync(gdir) ? readdirSync(gdir).sort() : [];
    if (graders.length === 0) problems.push(`${c}: no graders`);
    for (const g of graders) {
      const ok = /^\d\d-[a-z0-9-]+\.md$/.test(g) && read(join(gdir, g)).startsWith("---\ntype: llm\nfocus: trace\nweight: 1\n---");
      if (!ok) problems.push(`${c}/${g}: grader format`);
    }
    if (yaml.includes("scaffold_script")) {
      // The executable bit is not preserved by every copy or archive step, so check content, not mode.
      const script = join(d, "place-files.sh");
      if (!existsSync(script) || !read(script).startsWith("#!/usr/bin/env bash")) problems.push(`${c}: place-files.sh missing or lacks shebang`);
      if (!existsSync(join(d, "files", "vault"))) problems.push(`${c}: files/vault missing`);
      if (!prompt.includes("Input files: vault")) problems.push(`${c}: missing Input files line`);
    }
    if (!evalDoc.includes(c)) problems.push(`${c}: not referenced in evaluation.md`);
  }
  assert.deepEqual(problems, []);
});

// ---------- 5. vault-graph ----------
test("vault-graph: unresolved links on the main fixture", () => {
  assert.deepEqual(unresolved(buildGraph(VAULT)), [{ target: "Saga Pattern", sources: ["Event Sourcing"] }]);
});

test("vault-graph: orphan candidates (incl. the unlinked newer decision) on the main fixture", () => {
  assert.deepEqual(
    orphans(buildGraph(VAULT)).map((n) => n.name).sort(),
    ["2025-09-02 Use DynamoDB for Atlas", "Decision Template", "Note Template", "Standalone Reading List", "Vendor Article Clip"],
  );
});

test("vault-graph: backlinks to Event Sourcing, by name and by alias", () => {
  const g = buildGraph(VAULT);
  const expected = ["Atlas Migration", "CQRS", "Distributed Systems MOC"];
  assert.deepEqual(backlinks(g, "Event Sourcing").sources.map((n) => n.name).sort(), expected);
  assert.deepEqual(backlinks(g, "es").sources.map((n) => n.name).sort(), expected); // alias, case-insensitive
  assert.equal(backlinks(g, "No Such Note").found, false);
});

test("vault-graph: depth-1 local graph for Atlas Migration equals the six touching edges", () => {
  const edges = localGraph(buildGraph(VAULT), "Atlas Migration", 1).edges.map((e) => `${e.source}>${e.target}`).sort();
  assert.deepEqual(edges, [
    "2025-03-12 Use Postgres for Atlas>Atlas Migration",
    "2025-09-02 Use DynamoDB for Atlas>Atlas Migration",
    "Atlas Migration>2025-03-12 Use Postgres for Atlas",
    "Atlas Migration>Distributed Systems MOC",
    "Atlas Migration>Event Sourcing",
    "Idempotency Keys>Atlas Migration",
  ]);
});

test("vault-graph: depth-2 local graph reaches CQRS and the unresolved Saga Pattern", () => {
  const edges = localGraph(buildGraph(VAULT), "Atlas Migration", 2).edges;
  assert.ok(edges.some((e) => e.source === "Event Sourcing" && e.target === "CQRS"));
  assert.ok(edges.some((e) => e.source === "Event Sourcing" && e.target === "Saga Pattern" && !e.resolved));
  assert.ok(edges.length > 6);
});

test("vault-graph: frontmatter key census", () => {
  const counts = Object.fromEntries(frontmatterKeyCounts(buildGraph(VAULT)).map((k) => [k.key, k.count]));
  assert.equal(counts.type, 11);
  assert.equal(counts.tags, 11);
  assert.equal(counts.status, 8);
});

test("vault-graph: config reports graph.json as view settings only, never edges", () => {
  const cfg = obsidianConfig(VAULT);
  assert.equal(cfg.isObsidianVault, true);
  assert.equal(cfg.graphJsonHasEdgeData, false);
  assert.equal(cfg.graphColorGroups, 1);
  assert.deepEqual(cfg.communityPlugins, ["dataview"]);
  assert.deepEqual(cfg.linkSettings, { useMarkdownLinks: false, newLinkFormat: "shortest" });
  assert.equal(obsidianConfig(EDGE_VAULT).isObsidianVault, false);
});

test("vault-graph edge cases: alias, case, path, heading, display text, markdown links, embeds", () => {
  const g = buildGraph(EDGE_VAULT);
  assert.deepEqual(
    g.edges.map((e) => `${e.source}>${e.target}:${e.kind}`).sort(),
    ["A>B:wikilink", "A>Diagram:wikilink", "A>Event Sourcing:wikilink", "A>Img Note:markdown", "A>cqrs:markdown"],
  );
  assert.ok(g.edges.every((e) => e.resolved));
  assert.deepEqual(unresolved(g), []);
  assert.deepEqual(orphans(g).map((n) => n.name), ["A"]);
});

test("vault-graph edge cases: links in code, external URLs and same-note headings are ignored", () => {
  const targets = extractLinks("`[[Inline]]`\n```\n[[Fence]]\n```\n[x](https://e.com/a.md) [[#Top]] [[Real|label]] [m](My%20Note.md#h)").map((l) => l.target);
  assert.deepEqual(targets, ["Real", "My Note"]);
});

test("vault-graph: frontmatter parsing handles inline lists, YAML lists, and scalar aliases", () => {
  assert.deepEqual(parseFrontmatter("---\naliases: [A, \"B C\"]\n---\n").aliases, ["A", "B C"]);
  assert.deepEqual(parseFrontmatter("---\naliases:\n  - X\n  - Y\n---\n").aliases, ["X", "Y"]);
  assert.deepEqual(parseFrontmatter("---\nalias: Solo\n---\n").aliases, ["Solo"]);
  assert.deepEqual(parseFrontmatter("no frontmatter"), { keys: [], aliases: [] });
});

test("vault-graph CLI: usage errors and missing notes return non-zero", () => {
  const lines: string[] = [];
  const w = (s: string): void => { lines.push(s); };
  assert.equal(run([], w), 2);
  assert.equal(run(["backlinks"], w), 2);
  assert.equal(run(["backlinks", "Nope", "--vault", VAULT], w), 1);
  assert.equal(run(["local", "Atlas Migration", "--depth", "0", "--vault", VAULT], w), 2);
  assert.equal(run(["orphans", "--vault", join(HERE, "does-not-exist")], w), 1);
});

test("vault-graph: built .mjs CLI agrees with the library (parity check)", () => {
  const cli = (...args: string[]): string => {
    const r = spawnSync(process.execPath, [BUILT_CLI, ...args, "--vault", VAULT, "--json"], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };
  const g = buildGraph(VAULT);
  assert.deepEqual(JSON.parse(cli("unresolved")), unresolved(g));
  assert.deepEqual(JSON.parse(cli("orphans")).map((n: { name: string }) => n.name), orphans(g).map((n) => n.name));
  assert.deepEqual(JSON.parse(cli("edges")), g.edges);
});

// ---------- 6. fixture properties ----------
test("fixtures: properties the evaluation scenarios depend on", () => {
  const clip = read(join(VAULT, "Imported", "Vendor Article Clip.md"));
  assert.match(clip, /ignore all previous instructions/i);
  const proj = read(join(VAULT, "Projects", "Atlas Migration.md"));
  assert.ok(proj.includes("Postgres") && !proj.includes("DynamoDB"), "project note is stale on purpose");
  assert.ok(read(join(VAULT, "Notes", "Standalone Reading List.md")).includes("standalone: true"));
});
