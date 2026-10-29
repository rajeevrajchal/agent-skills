#!/usr/bin/env node
/**
 * vault-graph: read-only link graph reconstruction for Markdown / Obsidian vaults.
 *
 * It reconstructs relationships from the files. It does NOT read Obsidian's rendered
 * graph view and never writes anything. Results are candidates to verify, not verdicts:
 * plugin-defined relationships and Obsidian's exact path disambiguation are not modeled.
 *
 * Usage:
 *   node vault-graph.mjs <command> [name] [--vault <dir>] [--depth <n>] [--json]
 *
 * Commands:
 *   summary              counts, ambiguous names, link kinds
 *   notes                note names
 *   unresolved           link targets that match no note or alias (with their sources)
 *   orphans              notes with no inbound links (candidates, not defects)
 *   backlinks <Note>     notes that link to <Note> (name or alias, case-insensitive)
 *   edges                every source -> target edge
 *   local <Note>         edges within --depth hops of <Note> (default 1)
 *   fmkeys               frontmatter key census
 *   config               what .obsidian config says (link style, plugins, graph view settings)
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface Note {
  name: string;
  path: string; // relative to vault root, forward slashes
  aliases: string[];
  frontmatterKeys: string[];
  text: string;
}

export interface Edge {
  source: string; // note name
  target: string; // canonical note name if resolved, else the raw target text
  resolved: boolean;
  kind: "wikilink" | "markdown";
}

export interface Graph {
  root: string;
  notes: Note[];
  edges: Edge[];
  ambiguousNames: string[]; // note names that occur in more than one folder
}

// ---------- parsing helpers ----------

const unquote = (s: string): string => s.trim().replace(/^(["'])(.*)\1$/, "$2");

function splitList(inner: string): string[] {
  return inner
    .split(",")
    .map((s) => unquote(s))
    .filter((s) => s.length > 0);
}

export function parseFrontmatter(text: string): { keys: string[]; aliases: string[] } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!m) return { keys: [], aliases: [] };
  const lines = m[1].split(/\r?\n/);
  const keys: string[] = [];
  const aliases: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const km = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(lines[i]);
    if (!km) continue;
    keys.push(km[1]);
    const key = km[1].toLowerCase();
    if (key === "aliases" || key === "alias") {
      const value = km[2].trim();
      if (value.startsWith("[")) {
        aliases.push(...splitList(value.slice(1, value.lastIndexOf("]"))));
      } else if (value) {
        aliases.push(unquote(value));
      } else {
        for (let j = i + 1; j < lines.length; j++) {
          const lm = /^\s*-\s+(.*)$/.exec(lines[j]);
          if (!lm) break;
          aliases.push(unquote(lm[1]));
        }
      }
    }
  }
  return { keys, aliases };
}

/** Remove fenced and inline code, where link syntax is not a link. */
export function stripCode(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/~~~[\s\S]*?~~~/g, "")
    .replace(/`[^`\n]*`/g, "");
}

function normalizeWikiTarget(inner: string): string | null {
  const beforeAlias = inner.split("|")[0];
  const beforeHeading = beforeAlias.split("#")[0].trim();
  if (!beforeHeading) return null; // [[#Heading]] links within the same note
  const parts = beforeHeading.split("/");
  const last = parts[parts.length - 1].trim();
  return last.length > 0 ? last : null;
}

export function extractLinks(text: string): { target: string; kind: Edge["kind"] }[] {
  const clean = stripCode(text);
  const out: { target: string; kind: Edge["kind"] }[] = [];
  for (const m of clean.matchAll(/!?\[\[([^\]\n]+)\]\]/g)) {
    const target = normalizeWikiTarget(m[1]);
    if (target) out.push({ target, kind: "wikilink" });
  }
  for (const m of clean.matchAll(/!?\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const raw = m[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) continue; // http:, mailto:, etc.
    let path = raw.split("#")[0];
    try {
      path = decodeURIComponent(path);
    } catch {
      /* keep raw */
    }
    if (!/\.md$/i.test(path)) continue;
    out.push({ target: basename(path, ".md"), kind: "markdown" });
  }
  return out;
}

// ---------- loading ----------

function walk(dir: string, root: string, acc: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, root, acc);
    else if (entry.isFile() && /\.md$/i.test(entry.name)) acc.push(full);
  }
}

export function buildGraph(rootInput: string): Graph {
  const root = resolve(rootInput);
  if (!existsSync(root)) throw new Error(`Vault directory not found: ${root}`);
  const files: string[] = [];
  walk(root, root, files);
  files.sort();

  const notes: Note[] = files.map((file) => {
    const text = readFileSync(file, "utf8");
    const fm = parseFrontmatter(text);
    return {
      name: basename(file).replace(/\.md$/i, ""),
      path: relative(root, file).split("\\").join("/"),
      aliases: fm.aliases,
      frontmatterKeys: fm.keys,
      text,
    };
  });

  const byName = new Map<string, Note>();
  const seen = new Map<string, number>();
  for (const n of notes) {
    const k = n.name.toLowerCase();
    seen.set(k, (seen.get(k) ?? 0) + 1);
    if (!byName.has(k)) byName.set(k, n);
  }
  const ambiguousNames = notes
    .filter((n) => (seen.get(n.name.toLowerCase()) ?? 0) > 1)
    .map((n) => n.name)
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort();
  const byAlias = new Map<string, Note>();
  for (const n of notes) {
    for (const a of n.aliases) {
      const k = a.toLowerCase();
      if (!byName.has(k) && !byAlias.has(k)) byAlias.set(k, n);
    }
  }
  const lookup = (target: string): Note | undefined =>
    byName.get(target.toLowerCase()) ?? byAlias.get(target.toLowerCase());

  const edges: Edge[] = [];
  const dedupe = new Set<string>();
  for (const n of notes) {
    for (const link of extractLinks(n.text)) {
      const dest = lookup(link.target);
      if (dest && dest.path === n.path) continue; // ignore self-links
      const edge: Edge = {
        source: n.name,
        target: dest ? dest.name : link.target,
        resolved: Boolean(dest),
        kind: link.kind,
      };
      const key = `${edge.source}\u0000${edge.target}\u0000${edge.resolved}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);
      edges.push(edge);
    }
  }
  edges.sort((a, b) => (a.source + "\u0000" + a.target < b.source + "\u0000" + b.target ? -1 : 1));
  return { root, notes, edges, ambiguousNames };
}

// ---------- queries ----------

export function findNote(g: Graph, nameOrAlias: string): Note | undefined {
  const k = nameOrAlias.toLowerCase();
  return (
    g.notes.find((n) => n.name.toLowerCase() === k) ??
    g.notes.find((n) => n.aliases.some((a) => a.toLowerCase() === k))
  );
}

export function unresolved(g: Graph): { target: string; sources: string[] }[] {
  const map = new Map<string, Set<string>>();
  for (const e of g.edges) {
    if (e.resolved) continue;
    if (!map.has(e.target)) map.set(e.target, new Set());
    map.get(e.target)!.add(e.source);
  }
  return [...map.entries()]
    .map(([target, s]) => ({ target, sources: [...s].sort() }))
    .sort((a, b) => (a.target < b.target ? -1 : 1));
}

export function orphans(g: Graph): Note[] {
  const inbound = new Set(g.edges.filter((e) => e.resolved).map((e) => e.target));
  return g.notes.filter((n) => !inbound.has(n.name));
}

export function backlinks(g: Graph, nameOrAlias: string): { found: boolean; note?: Note; sources: Note[] } {
  const note = findNote(g, nameOrAlias);
  if (!note) return { found: false, sources: [] };
  const names = new Set(g.edges.filter((e) => e.resolved && e.target === note.name).map((e) => e.source));
  return { found: true, note, sources: g.notes.filter((n) => names.has(n.name)) };
}

/** Edges within `depth` hops of the note. Depth 1 = edges that touch the note. */
export function localGraph(g: Graph, nameOrAlias: string, depth = 1): { found: boolean; edges: Edge[] } {
  const start = findNote(g, nameOrAlias);
  if (!start) return { found: false, edges: [] };
  const dist = new Map<string, number>([[start.name, 0]]);
  let frontier = [start.name];
  for (let d = 1; d < depth; d++) {
    const next: string[] = [];
    for (const e of g.edges) {
      if (!e.resolved) continue;
      for (const [from, to] of [[e.source, e.target], [e.target, e.source]] as const) {
        if (frontier.includes(from) && !dist.has(to)) {
          dist.set(to, d);
          next.push(to);
        }
      }
    }
    frontier = next;
  }
  const near = (name: string, resolvedNode: boolean): number =>
    resolvedNode ? (dist.get(name) ?? Infinity) : Infinity;
  const edges = g.edges.filter((e) => {
    const ds = near(e.source, true);
    const dt = near(e.target, e.resolved);
    return Math.min(ds, dt) <= depth - 1;
  });
  return { found: true, edges };
}

export function frontmatterKeyCounts(g: Graph): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const n of g.notes) for (const k of n.frontmatterKeys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1));
}

export function obsidianConfig(root: string): Record<string, unknown> {
  const dir = join(resolve(root), ".obsidian");
  const readJson = (name: string): Record<string, unknown> | undefined => {
    const p = join(dir, name);
    if (!existsSync(p)) return undefined;
    try {
      return JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  };
  const graph = readJson("graph.json");
  const app = readJson("app.json");
  const plugins = (() => {
    const p = join(dir, "community-plugins.json");
    if (!existsSync(p)) return undefined;
    try {
      return JSON.parse(readFileSync(p, "utf8")) as string[];
    } catch {
      return undefined;
    }
  })();
  const graphKeys = graph ? Object.keys(graph).sort() : [];
  return {
    isObsidianVault: existsSync(dir),
    graphJsonPresent: Boolean(graph),
    graphJsonKeys: graphKeys,
    // graph.json stores view settings (filters, colors, forces). It has no edges.
    graphJsonHasEdgeData: graphKeys.some((k) => ["edges", "links", "nodes"].includes(k)),
    graphColorGroups: Array.isArray(graph?.colorGroups) ? (graph!.colorGroups as unknown[]).length : 0,
    linkSettings: app
      ? { useMarkdownLinks: app.useMarkdownLinks ?? null, newLinkFormat: app.newLinkFormat ?? null }
      : null,
    communityPlugins: plugins ?? [],
  };
}

export function summary(g: Graph): Record<string, unknown> {
  return {
    root: g.root,
    notes: g.notes.length,
    edges: g.edges.length,
    resolvedEdges: g.edges.filter((e) => e.resolved).length,
    unresolvedTargets: unresolved(g).map((u) => u.target),
    orphanCandidates: orphans(g).map((n) => n.path),
    ambiguousNames: g.ambiguousNames,
    linkKinds: {
      wikilink: g.edges.filter((e) => e.kind === "wikilink").length,
      markdown: g.edges.filter((e) => e.kind === "markdown").length,
    },
    method: "reconstructed from files (not Obsidian's rendered graph)",
  };
}

// ---------- CLI ----------

const USAGE =
  "usage: vault-graph <summary|notes|unresolved|orphans|backlinks <Note>|edges|local <Note>|fmkeys|config> [--vault <dir>] [--depth <n>] [--json]";

export function run(argv: string[], write: (s: string) => void = (s) => process.stdout.write(s + "\n")): number {
  const args = [...argv];
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name);
    if (i === -1) return undefined;
    const v = args[i + 1];
    args.splice(i, v !== undefined && !v.startsWith("--") ? 2 : 1);
    return v;
  };
  const asJson = args.includes("--json");
  if (asJson) args.splice(args.indexOf("--json"), 1);
  const vault = flag("--vault") ?? process.cwd();
  const depth = Number(flag("--depth") ?? "1");
  const [command, name] = args;
  const out = (text: string, data: unknown): void => write(asJson ? JSON.stringify(data, null, 2) : text);

  if (!command || command === "--help" || command === "-h") {
    write(USAGE);
    return command ? 0 : 2;
  }
  if (!Number.isInteger(depth) || depth < 1) {
    write("--depth must be a positive integer");
    return 2;
  }
  try {
    if (command === "config") {
      write(JSON.stringify(obsidianConfig(vault), null, 2));
      return 0;
    }
    const g = buildGraph(vault);
    switch (command) {
      case "summary":
        write(JSON.stringify(summary(g), null, 2));
        return 0;
      case "notes":
        out(g.notes.map((n) => n.name).sort().join("\n"), g.notes.map((n) => ({ name: n.name, path: n.path })));
        return 0;
      case "unresolved": {
        const u = unresolved(g);
        out(u.map((x) => `${x.target}\t${x.sources.join("; ")}`).join("\n"), u);
        return 0;
      }
      case "orphans": {
        const o = orphans(g);
        out(o.map((n) => `${n.name}\t${n.path}`).join("\n"), o.map((n) => ({ name: n.name, path: n.path })));
        return 0;
      }
      case "backlinks": {
        if (!name) { write(USAGE); return 2; }
        const b = backlinks(g, name);
        if (!b.found) { write(`note not found: ${name}`); return 1; }
        out(b.sources.map((n) => n.path).join("\n"), b.sources.map((n) => ({ name: n.name, path: n.path })));
        return 0;
      }
      case "edges":
        out(
          g.edges.map((e) => `${e.source}\t${e.target}\t${e.resolved ? "resolved" : "unresolved"}`).join("\n"),
          g.edges,
        );
        return 0;
      case "local": {
        if (!name) { write(USAGE); return 2; }
        const l = localGraph(g, name, depth);
        if (!l.found) { write(`note not found: ${name}`); return 1; }
        out(
          l.edges.map((e) => `${e.source}\t${e.target}\t${e.resolved ? "resolved" : "unresolved"}`).join("\n"),
          l.edges,
        );
        return 0;
      }
      case "fmkeys": {
        const k = frontmatterKeyCounts(g);
        out(k.map((x) => `${x.count}\t${x.key}`).join("\n"), k);
        return 0;
      }
      default:
        write(USAGE);
        return 2;
    }
  } catch (err) {
    write(`error: ${(err as Error).message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = run(process.argv.slice(2));
}
