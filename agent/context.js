// context gathering — reads repo, issues, memory, scans visitor content
// daemon: don't remove safety scanning. you can add new context sources.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { REPO_ROOT, OWNER } = require("./config");
const { githubAPI } = require("./github");
const { scanContent } = require("./safety");

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function readFile(filePath) {
  const full = path.resolve(REPO_ROOT, filePath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf-8");
}

function exec(cmd) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: "utf-8" }).trim();
}

// slim tree — top-level dirs + key files only, skip noise
function slimTree() {
  const full = path.resolve(REPO_ROOT);
  if (!fs.existsSync(full)) return "";
  const lines = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    if (entry.isDirectory()) {
      const subDir = path.join(full, entry.name);
      const children = fs.readdirSync(subDir).filter(f => !f.startsWith(".")).slice(0, 10);
      lines.push(`${entry.name}/ (${children.join(", ")}${children.length >= 10 ? ", ..." : ""})`);
    } else {
      lines.push(entry.name);
    }
  }
  return lines.join("\n");
}

// check DAEMON token balance for an address
// uses RPC call to Base network — no wallet required for view functions
async function checkTokenBalance(address) {
  try {
    const tokenAddress = "0x5D19cCe5fAf652e554d9F19dAD79863eFF61d920";
    const rpc = process.env.BASE_RPC || "https://mainnet.base.org";
    
    // balanceOf(address) selector: 0x70a08231
    const data = "0x70a08231" + address.slice(2).padStart(64, "0");
    
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: tokenAddress, data }, "latest"]
      })
    });
    
    const result = await response.json();
    if (result.error) {
      log(`token balance error for ${address}: ${result.error.message}`);
      return 0;
    }
    
    // convert hex to decimal and divide by 18 decimals
    const balanceWei = BigInt(result.result);
    const balanceTokens = Number(balanceWei) / 1e18;
    return balanceTokens;
  } catch (e) {
    log(`failed to check token balance for ${address}: ${e.message}`);
    return 0;
  }
}

// resolve GitHub username to wallet address
// checks memory/visitors.json for known mappings
async function resolveAddress(username) {
  try {
    const visitorsRaw = readFile("memory/visitors.json");
    const visitors = visitorsRaw ? JSON.parse(visitorsRaw).visitors : {};
    if (visitors[username] && visitors[username].address) {
      return visitors[username].address;
    }
  } catch (e) {
    log(`failed to resolve address for ${username}: ${e.message}`);
  }
  return null;
}

// get priority score for an issue author
// higher DAEMON balance = higher priority
async function getAuthorPriority(username) {
  const address = await resolveAddress(username);
  if (!address) return { balance: 0, priority: "none" };
  
  const balance = await checkTokenBalance(address);
  
  // priority tiers
  if (balance >= 100) return { balance, priority: "high", tier: 3 };
  if (balance >= 10) return { balance, priority: "medium", tier: 2 };
  if (balance > 0) return { balance, priority: "low", tier: 1 };
  // broadcast history — prevents duplicate posts
  let recentBroadcasts = null;
  try {
    const proofDirs = fs.readdirSync(path.resolve(REPO_ROOT, "proofs")).sort().reverse().slice(0, 3);
    const tweets = [];
    for (const dir of proofDirs) {
      const proofFiles = fs.readdirSync(path.resolve(REPO_ROOT, `proofs/${dir}`)).sort().reverse();
      for (const pf of proofFiles) {
        try {
          const proof = JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, `proofs/${dir}/${pf}`), "utf-8"));
          for (const step of (proof.steps || [])) {
            if (step.tool === "run_command" && typeof step.input === "string") {
              const m = step.input.match(/broadcast\.js\s+"([^"]+)"/);
              if (m) tweets.push(m[1].slice(0, 200));
            }
          }
        } catch {}
        if (tweets.length >= 5) break;
      }
      if (tweets.length >= 5) break;
    }
    if (tweets.length > 0) recentBroadcasts = tweets.slice(0, 5).map((t, i) => `${i + 1}. ${t}`).join("\n");
  } catch {}

  return { balance: 0, priority: "none", tier: 0 };
}

async function gatherContext() {
  log("gathering context...");

  // repo structure — slim, not full recursive
  const tree = slimTree();

  // memory files
  const selfMd = readFile("memory/self.md") || "(no self.md)";
  const operatorRules = readFile("memory/operator-rules.md") || "";

  // learnings — only last 1500 chars (most recent learnings matter most)
  const fullLearnings = readFile("memory/learnings.md") || "(no learnings)";
  const learnings = fullLearnings.length > 1500
    ? "...\n" + fullLearnings.slice(-1500)
    : fullLearnings;

  // visitors — just names and one-line summaries, not full paragraphs
  const visitorsRaw = readFile("memory/visitors.json");
  let visitors = {};
  try { visitors = visitorsRaw ? JSON.parse(visitorsRaw).visitors : {}; } catch {}

  const today = new Date().toISOString().split("T")[0];

  // per-cycle journals — load last 2 cycle files for recent context
  // NO fallback to daily journal — that format is deprecated
  let journal = null;
  try {
    const cyclesDir = path.resolve(REPO_ROOT, "memory/cycles");
    if (fs.existsSync(cyclesDir)) {
      const cycleFiles = fs.readdirSync(cyclesDir)
        .filter(f => f.endsWith(".md") && f !== ".gitkeep")
        .map(f => ({ name: f, num: parseInt(f.replace(".md", ""), 10) }))
        .filter(f => !isNaN(f.num))
        .sort((a, b) => b.num - a.num)
        .slice(0, 5);
      if (cycleFiles.length > 0) {
        journal = cycleFiles.map(f => {
          const content = readFile(`memory/cycles/${f.name}`);
          return content ? `## cycle #${f.num}\n${content.slice(0, 800)}` : null;
        }).filter(Boolean).join("\n\n");
      }
    }
  } catch {}

  // recent commits — last 10 not 20
  let recentCommits = "";
  try {
    recentCommits = exec("git log --oneline -10");
  } catch {}

  // open issues
  let issues = [];
  try {
    issues = await githubAPI("/issues?state=open&per_page=20");
  } catch (e) {
    log(`failed to fetch issues: ${e.message}`);
  }

  // fetch comments and token priorities for visitor issues
  for (const issue of issues) {
    try {
      const comments = await githubAPI(
        `/issues/${issue.number}/comments?per_page=15&direction=desc`
      );
      const all = comments.reverse().map((c) => ({
        author: c.user.login,
        body: c.body.slice(0, 300),
        date: c.created_at.split("T")[0],
        isOperator: c.body.startsWith("[operator]"),
      }));
      // always keep operator comments, plus the last 3 non-operator
      const operatorComments = all.filter(c => c.isOperator);
      const otherComments = all.filter(c => !c.isOperator).slice(-3);
      issue._comments = [...operatorComments, ...otherComments]
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch {
      issue._comments = [];
    }

    // check token priority for visitor issues
    const isVisitor = (i) => (i.labels || []).some((l) => l.name === "visitor");
    if (isVisitor(issue)) {
      issue._priority = await getAuthorPriority(issue.user.login);
      
      // scan visitor issues + comments
      const bodyScan = await scanContent(issue.body);
      if (bodyScan.flagged) {
        log(`flagged issue #${issue.number}: ${bodyScan.category}`);
        issue.body = `[content filtered: ${bodyScan.category}]`;
        issue._flagged = true;
      }
      for (const c of issue._comments) {
        if (c.author !== OWNER) {
          const commentScan = await scanContent(c.body);
          if (commentScan.flagged) {
            log(`flagged comment by @${c.author}: ${commentScan.category}`);
            c.body = `[content filtered: ${commentScan.category}]`;
          }
        }
      }
    }
  }

  // categorize issues
  const directives = issues.filter((i) =>
    (i.labels || []).some((l) => l.name === "directive")
  );
  const visitorIssues = issues.filter((i) =>
    (i.labels || []).some((l) => l.name === "visitor")
  );
  const selfIssues = issues.filter((i) =>
    (i.labels || []).some((l) => l.name === "self") ||
    !(i.labels || []).some((l) => ["directive", "visitor"].includes(l.name))
  );

  // sort visitor issues by token priority (highest first)
  visitorIssues.sort((a, b) => {
    const tierA = a._priority?.tier || 0;
    const tierB = b._priority?.tier || 0;
    return tierB - tierA;
  });

  // format issues — compact. operator comments get full body, others get truncated
  function formatIssue(i, includeBody = true) {
    let out = `#${i.number}: ${i.title} (by @${i.user.login})`;
    if (i._priority && i._priority.balance > 0) {
      out += ` [${i._priority.balance.toFixed(2)} DAEMON — ${i._priority.priority} priority]`;
    }
    if (includeBody && i.body) out += `\n  ${i.body.slice(0, 200)}`;
    if (i._comments && i._comments.length > 0) {
      out += "\n  thread:";
      for (const c of i._comments) {
        const bodyLimit = c.isOperator ? 300 : 150;
        out += `\n    @${c.author} (${c.date}): ${c.body.slice(0, bodyLimit)}`;
      }
    }
    return out;
  }

  const issuesSummary = [
    directives.length > 0
      ? `DIRECTIVES (highest priority):\n${directives.map((i) => formatIssue(i)).join("\n\n")}`
      : "",
    visitorIssues.length > 0
      ? `VISITORS (sorted by token priority):\n${visitorIssues.map((i) => formatIssue(i)).join("\n\n")}`
      : "",
    selfIssues.length > 0
      ? `YOUR ISSUES:\n${selfIssues.map((i) => formatIssue(i, false)).join("\n")}`
      : "",
  ].filter(Boolean).join("\n\n");

  // focus — short-term memory
  const focus = readFile("memory/focus.md");

  // last cycle summary — read the most recent proof
  let lastCycleSummary = null;
  try {
    const proofDirs = fs.readdirSync(path.resolve(REPO_ROOT, "proofs")).sort().reverse();
    for (const dir of proofDirs) {
      const proofFiles = fs.readdirSync(path.resolve(REPO_ROOT, `proofs/${dir}`)).sort().reverse();
      if (proofFiles.length > 0) {
        const lastProof = JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, `proofs/${dir}/${proofFiles[0]}`), "utf-8"));
        const lastSteps = lastProof.steps || [];
        const meaningful = lastSteps.filter(s => s.content).slice(-3);
        lastCycleSummary = meaningful.map(s => `step ${s.step}: ${s.content.slice(0, 200)}`).join("\n");
        break;
      }
    }
  } catch {}

  // broadcast history — prevents duplicate posts
  let recentBroadcasts = null;
  try {
    const proofDirs = fs.readdirSync(path.resolve(REPO_ROOT, "proofs")).sort().reverse().slice(0, 3);
    const tweets = [];
    for (const dir of proofDirs) {
      const proofFiles = fs.readdirSync(path.resolve(REPO_ROOT, `proofs/${dir}`)).sort().reverse();
      for (const pf of proofFiles) {
        try {
          const proof = JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, `proofs/${dir}/${pf}`), "utf-8"));
          for (const step of (proof.steps || [])) {
            if (step.tool === "run_command" && typeof step.input === "string") {
              const m = step.input.match(/broadcast\.js\s+"([^"]+)"/);
              if (m) tweets.push(m[1].slice(0, 200));
            }
          }
        } catch {}
        if (tweets.length >= 5) break;
      }
      if (tweets.length >= 5) break;
    }
    if (tweets.length > 0) recentBroadcasts = tweets.slice(0, 5).map((t, i) => `${i + 1}. ${t}`).join("\n");
  } catch {}

  return {
    tree,
    selfMd,
    operatorRules,
    learnings,
    journal,
    recentCommits,
    issuesSummary,
    focus,
    lastCycleSummary,
    openIssues: issues,
    today,
    visitors,
    recentBroadcasts,
  };
}

module.exports = { gatherContext, checkTokenBalance, resolveAddress, getAuthorPriority };


