#!/usr/bin/env node
/**
 * agent loop — multi-step orchestrator with native tool calling
 *
 * wakes up → gathers context → thinks and acts in a loop →
 * observes results → thinks again → repeats until done.
 *
 * uses OpenRouter/Venice native tool calling — no JSON parsing hacks.
 * zero extra dependencies — runs on node 20 built-in fetch.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { REPO_ROOT, LLM_KEY, GH_TOKEN, MODEL, MAX_STEPS } = require("./config");
const { inference } = require("./inference");
const { gatherContext } = require("./context");
const { executeTool, filesChanged } = require("./actions");
const { TOOLS } = require("./tools");
const { buildSystemPrompt, buildUserPrompt } = require("./prompt");

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function exec(cmd) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: "utf-8" }).trim();
}

// --- cycle state: persistent counter + log ---
const STATE_PATH = path.resolve(REPO_ROOT, "memory/state.json");
const CYCLES_PATH = path.resolve(REPO_ROOT, "memory/cycles.jsonl");

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
  } catch {
    return { cycle: 0, born: new Date().toISOString(), lastActive: null };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
  filesChanged.add("memory/state.json");
}

function logCycle(entry) {
  fs.appendFileSync(CYCLES_PATH, JSON.stringify(entry) + "\n", "utf-8");
  filesChanged.add("memory/cycles.jsonl");
}

async function main() {
  log("daemon waking up...");

  if (!LLM_KEY) throw new Error("No LLM API key set (OPENROUTER_API_KEY or VENICE_API_KEY)");
  if (!GH_TOKEN) throw new Error("GH_TOKEN not set");

  // load + increment cycle counter
  const state = loadState();
  state.cycle++;
  if (!state.born) state.born = new Date().toISOString();
  state.lastActive = new Date().toISOString();
  log(`cycle #${state.cycle} (alive since ${state.born})`);

  // ensure memory/cycles/ directory exists
  fs.mkdirSync(path.resolve(REPO_ROOT, "memory/cycles"), { recursive: true });

  // gather initial context
  const ctx = await gatherContext();
  ctx.cycle = state.cycle;
  ctx.born = state.born;
  log(`repo has ${ctx.tree.split("\n").length} files, ${ctx.openIssues.length} open issues`);

  // conversation history
  const messages = [
    { role: "system", content: buildSystemPrompt(ctx) },
    { role: "user", content: buildUserPrompt(ctx) },
  ];

  // proof collects all steps
  const proofSteps = [];
  let step = 0;

  // agentic loop: call model → execute tool calls → feed results back → repeat
  let consecutiveErrors = 0;
  while (step < MAX_STEPS) {
    step++;
    log(`--- step ${step}/${MAX_STEPS} ---`);

    let message, finishReason, usedModel;
    try {
      const result = await inference(messages, { tools: TOOLS });
      message = result.message;
      finishReason = result.finishReason;
      usedModel = result.model;
      consecutiveErrors = 0;
    } catch (e) {
      consecutiveErrors++;
      log(`inference error (${consecutiveErrors}/3): ${e.message}`);
      proofSteps.push({
        step,
        timestamp: new Date().toISOString(),
        model: MODEL,
        finishReason: "error",
        content: `inference failed: ${e.message}`,
        toolCalls: null,
      });
      if (consecutiveErrors >= 3) {
        log("3 consecutive inference errors — ending cycle gracefully");
        break;
      }
      await new Promise(r => setTimeout(r, 5000 * consecutiveErrors));
      step--;
      continue;
    }

    // record step
    proofSteps.push({
      step,
      timestamp: new Date().toISOString(),
      model: usedModel,
      finishReason,
      content: message.content,
      toolCalls: message.tool_calls || null,
    });

    messages.push(message);

    // if model returned text with no tool calls, it's done
    if (finishReason !== "tool_calls" || !message.tool_calls || message.tool_calls.length === 0) {
      if (message.content) log(`final response: ${message.content.slice(0, 200)}`);
      log("model finished (no more tool calls)");
      break;
    }

    // execute each tool call and feed results back
    for (const toolCall of message.tool_calls) {
      const { name } = toolCall.function;
      let args;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        log(`failed to parse args for ${name}: ${e.message}`);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: `error: failed to parse arguments: ${e.message}`,
        });
        continue;
      }

      try {
        const result = await executeTool(name, args);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: typeof result === "string" ? result : JSON.stringify(result),
        });
      } catch (e) {
        log(`tool ${name} failed: ${e.message}`);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: `error: ${e.message}`,
        });
      }
    }
  }

  if (step >= MAX_STEPS) log(`reached max steps (${MAX_STEPS})`);

  // save proof
  const proofTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const proof = {
    timestamp: new Date().toISOString(),
    model: MODEL,
    steps: proofSteps,
    total_steps: proofSteps.length,
    meta: {
      issues_open: ctx.openIssues.length,
      files_in_repo: ctx.tree.split("\n").length,
    },
  };
  const proofDate = new Date().toISOString().split("T")[0];
  const proofPath = `proofs/${proofDate}/${proofTimestamp}.json`;
  fs.mkdirSync(path.resolve(REPO_ROOT, `proofs/${proofDate}`), { recursive: true });
  fs.writeFileSync(
    path.resolve(REPO_ROOT, proofPath),
    JSON.stringify(proof, null, 2),
    "utf-8"
  );
  filesChanged.add(proofPath);
  log(`proof saved: ${proofPath} (${proofSteps.length} steps)`);

  // collect tools used
  const toolsUsed = [...new Set(
    proofSteps.flatMap((s) => (s.toolCalls || []).map((t) => t.function.name))
  )];

  logCycle({
    cycle: state.cycle,
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().split("T")[0],
    steps: proofSteps.length,
    tools: toolsUsed,
    filesChanged: [...filesChanged],
    issuesOpen: ctx.openIssues.length,
    model: proof.model,
  });

  saveState(state);

  // commit and push
  if (filesChanged.size > 0) {
    log(`committing ${filesChanged.size} changed files...`);
    exec("git add -A");

    const commitMsg = `[daemon] cycle #${state.cycle} (${proofSteps.length} steps)`;
    try {
      exec(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
      try {
        exec("git push");
      } catch {
        log("push rejected, rebasing...");
        exec("git pull --rebase");
        exec("git push");
      }
      log("pushed changes.");
    } catch (e) {
      log(`git commit/push failed: ${e.message}`);
    }
  } else {
    log("no file changes this cycle.");
  }

  log(`daemon sleeping. (${proofSteps.length} steps this cycle)`);
}

main().catch((e) => {
  console.error(`[FATAL] ${e.message}`);
  try {
    const proofDate = new Date().toISOString().split("T")[0];
    const proofTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const crashProof = {
      timestamp: new Date().toISOString(),
      model: MODEL,
      steps: [{ step: 0, timestamp: new Date().toISOString(), model: MODEL, finishReason: "fatal_error", content: e.message, toolCalls: null }],
      total_steps: 0,
      meta: { error: e.message },
    };
    fs.mkdirSync(path.resolve(REPO_ROOT, `proofs/${proofDate}`), { recursive: true });
    fs.writeFileSync(path.resolve(REPO_ROOT, `proofs/${proofDate}/${proofTimestamp}.json`), JSON.stringify(crashProof, null, 2));
    exec("git add -A");
    exec(`git commit -m "[daemon] crash recovery — ${e.message.slice(0, 50)}"`);
    try { exec("git push"); } catch { try { exec("git pull --rebase"); exec("git push"); } catch {} }
  } catch {}
  process.exit(1);
});
