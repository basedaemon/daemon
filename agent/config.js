// agent config — constants and environment
// you can change MODEL and MAX_TOKENS but don't remove SAFETY_MODEL

const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");

// repo identity — auto-detected from GITHUB_REPOSITORY env var (set by GitHub Actions)
const [OWNER, REPO] = (process.env.GITHUB_REPOSITORY || "your-username/your-repo").split("/");

// LLM provider — supports venice or openrouter (set one during setup)
const VENICE_KEY = process.env.VENICE_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const LLM_KEY = VENICE_KEY || OPENROUTER_KEY;
const LLM_PROVIDER = VENICE_KEY ? "venice" : "openrouter";
const GROQ_KEY = process.env.GROQ_API_KEY;
const GH_TOKEN = process.env.GH_TOKEN;

// model names differ per provider — change these to whatever you want
const MODELS = {
  venice: { main: "zai-org-glm-5", safety: "openai-gpt-oss-120b" },
  openrouter: { main: "moonshotai/kimi-k2.5", safety: "openai/gpt-oss-safeguard-20b" },
};
const MODEL = MODELS[LLM_PROVIDER]?.main || "moonshotai/kimi-k2.5";
const MAX_TOKENS = 16384;
const MAX_STEPS = 40; // max inference calls per cycle (prevents runaway)
const SAFETY_MODEL = MODELS[LLM_PROVIDER]?.safety || "openai/gpt-oss-safeguard-20b";

// wallet — your agent's onchain identity
const DAEMON_WALLET_KEY = process.env.DAEMON_WALLET_KEY;
const SAFE_ADDRESS = process.env.SAFE_ADDRESS || ""; // set if you use a Gnosis Safe
const BASE_RPC = process.env.BASE_RPC || "https://mainnet.base.org";
const PROJECT_NUMBER = parseInt(process.env.PROJECT_NUMBER || "1", 10); // GitHub Projects board number

module.exports = {
  REPO_ROOT, OWNER, REPO, LLM_KEY, LLM_PROVIDER, GROQ_KEY, GH_TOKEN,
  MODEL, MAX_TOKENS, MAX_STEPS, SAFETY_MODEL,
  DAEMON_WALLET_KEY, SAFE_ADDRESS, BASE_RPC, PROJECT_NUMBER,
};
