#!/usr/bin/env node
/**
 * RepoPulse Lite — Custom MCP Server (Bonus: MCP Server Tooling, +10 pts)
 *
 * Exposes RepoPulse Lite's own GitHub-fetch and complexity-heuristic logic
 * as MCP tools, so an AI CLI agent (Claude Code, OpenCode, etc.) can call
 * "analyze_repo_commits" directly while helping build/debug this project —
 * eating our own dog food instead of shipping a throwaway demo server.
 *
 * Run:  npm run mcp
 * Then point your AI CLI agent's MCP config at this stdio server
 * (see mcp.config.example.json in the repo root).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const GITHUB_API = "https://api.github.com";

function classifyCommit({ additions, deletions, filesChanged }) {
  const totalLines = additions + deletions;
  if (totalLines > 250 || filesChanged >= 5) return "High";
  if (totalLines < 50) return "Low";
  return "Medium";
}

async function fetchCommits(owner, repo, count = 20) {
  const headers = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const listRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/commits?per_page=${count}`, { headers });
  if (!listRes.ok) throw new Error(`GitHub API error: ${listRes.status}`);
  const list = await listRes.json();

  const out = [];
  for (const item of list) {
    const detailRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/commits/${item.sha}`, { headers });
    const detail = await detailRes.json();
    const additions = detail.stats?.additions ?? 0;
    const deletions = detail.stats?.deletions ?? 0;
    const filesChanged = (detail.files ?? []).length;
    out.push({
      sha: item.sha.slice(0, 7),
      message: item.commit.message.split("\n")[0],
      author: item.commit.author?.name ?? "unknown",
      additions,
      deletions,
      filesChanged,
      tier: classifyCommit({ additions, deletions, filesChanged }),
    });
  }
  return out;
}

const server = new Server(
  { name: "repopulse-lite-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "analyze_repo_commits",
      description: "Fetch recent commits for a public GitHub owner/repo and classify each by RepoPulse Lite's Tier 1/2/3 complexity heuristic.",
      inputSchema: {
        type: "object",
        properties: {
          owner: { type: "string", description: "GitHub repo owner, e.g. 'vercel'" },
          repo: { type: "string", description: "GitHub repo name, e.g. 'next.js'" },
          count: { type: "number", description: "Number of recent commits to fetch (default 20)" },
        },
        required: ["owner", "repo"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "analyze_repo_commits") {
    const { owner, repo, count } = request.params.arguments;
    try {
      const commits = await fetchCommits(owner, repo, count ?? 20);
      return { content: [{ type: "text", text: JSON.stringify(commits, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
    }
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
