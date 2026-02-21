// inference — multi-provider API calls with fallbacks

const { LLM_KEY, LLM_PROVIDER, GROQ_KEY, MODEL, MAX_TOKENS } = require("./config");

// provider endpoints
const ENDPOINTS = {
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  venice: "https://api.venice.ai/api/v1/chat/completions",
};

// provider fallback chain
const PROVIDERS = [
  {
    name: LLM_PROVIDER,
    url: ENDPOINTS[LLM_PROVIDER] || ENDPOINTS.openrouter,
    key: LLM_KEY,
    models: [MODEL],
    route: LLM_PROVIDER === "openrouter" ? "fallback" : undefined,
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    }),
  },
  {
    name: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: GROQ_KEY,
    models: ["llama-3.3-70b-versatile"],
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    }),
  },
];

async function inference(messages, { tools = null } = {}) {
  const errors = [];

  for (const provider of PROVIDERS) {
    if (!provider.key) continue;

    try {
      const body = {
        model: provider.models[0],
        max_tokens: MAX_TOKENS,
        messages,
        temperature: 0.7,
      };

      if (provider.route === "fallback" && provider.models.length > 1) {
        body.models = provider.models;
        body.route = "fallback";
      }

      if (tools) {
        body.tools = tools;
        body.tool_choice = "auto";
        body.parallel_tool_calls = true;
      }

      const res = await fetch(provider.url, {
        method: "POST",
        headers: provider.headers(provider.key),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`${provider.name} ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      const choice = data.choices[0];

      if (provider.name !== LLM_PROVIDER) {
        console.log(`[inference] used fallback provider: ${provider.name}`);
      }

      return {
        message: choice.message,
        finishReason: choice.finish_reason,
        model: data.model,
        provider: provider.name,
      };
    } catch (err) {
      errors.push(`${provider.name}: ${err.message}`);
      console.log(`[inference] ${provider.name} failed: ${err.message}`);
    }
  }

  throw new Error(`All inference providers failed:\n${errors.join("\n")}`);
}

module.exports = { inference };
