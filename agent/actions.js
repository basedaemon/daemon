// action execution — runs the tools daemon calls
// daemon: you can ADD new handlers here. go wild.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { ethers } = require("ethers");
const { REPO_ROOT, DAEMON_WALLET_KEY, BASE_RPC, SAFE_ADDRESS } = require("./config");
const { githubAPI, addToProject } = require("./github");
// inference import removed — web_search now uses DuckDuckGo directly

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

const filesChanged = new Set();


// executes a tool call and returns the result string
async function executeTool(name, args) {
  switch (name) {
    case "write_file": {
      const fullPath = path.resolve(REPO_ROOT, args.path);
      if (!fullPath.startsWith(REPO_ROOT + "/")) throw new Error("path escape attempt");
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, args.content, "utf-8");
      filesChanged.add(args.path);
      log(`wrote: ${args.path} (${args.content.length} chars)`);
      return `wrote ${args.path} (${args.content.length} chars)`;
    }
    case "append_file": {
      const fullPath = path.resolve(REPO_ROOT, args.path);
      if (!fullPath.startsWith(REPO_ROOT + "/")) throw new Error("path escape attempt");
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.appendFileSync(fullPath, args.content, "utf-8");
      filesChanged.add(args.path);
      log(`appended: ${args.path} (${args.content.length} chars)`);
      return `appended ${args.path} (${args.content.length} chars)`;
    }
    case "read_file": {
      const fullPath = path.resolve(REPO_ROOT, args.path);
      if (!fullPath.startsWith(REPO_ROOT + "/")) throw new Error("path escape attempt");
      if (!fs.existsSync(fullPath)) return `file not found: ${args.path}`;
      const content = fs.readFileSync(fullPath, "utf-8");
      const offset = args.offset || 1;
      const limit = args.limit || content.length;
      const lines = content.split("\n").slice(offset - 1, offset - 1 + limit);
      return lines.join("\n");
    }
    case "delete_file": {
      const fullPath = path.resolve(REPO_ROOT, args.path);
      if (!fullPath.startsWith(REPO_ROOT + "/")) throw new Error("path escape attempt");
      if (!fs.existsSync(fullPath)) return `file not found: ${args.path}`;
      fs.unlinkSync(fullPath);
      filesChanged.add(args.path);
      log(`deleted: ${args.path}`);
      return `deleted ${args.path}`;
    }
    case "search_files": {
      const { execSync } = require("child_process");
      const pattern = args.pattern.replace(/"/g, '\\"');
      const glob = args.glob || "*";
      const searchPath = args.path ? path.resolve(REPO_ROOT, args.path) : REPO_ROOT;
      try {
        const cmd = `grep -rn "${pattern}" ${searchPath} --include="${glob}" 2>/dev/null || true`;
        const results = execSync(cmd, { encoding: "utf-8", maxBuffer: 1024 * 1024 });
        return results.trim() || "no matches found";
      } catch (e) {
        return `search error: ${e.message}`;
      }
    }
    case "create_issue": {
      const issue = await githubAPI("/issues", {
        method: "POST",
        body: JSON.stringify({
          title: args.title,
          body: args.body || "",
          labels: args.labels || [],
        }),
      });
      if (issue.number) {
        await addToProject(issue.node_id);
        log(`created issue #${issue.number}: ${args.title}`);
        return `created issue #${issue.number}: ${args.title}`;
      }
      return `failed to create issue: ${JSON.stringify(issue)}`;
    }
    case "comment_issue": {
      const result = await githubAPI(`/issues/${args.number}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: args.body }),
      });
      log(`commented on issue #${args.number}`);
      return `commented on issue #${args.number}`;
    }
    case "close_issue": {
      await githubAPI(`/issues/${args.number}`, {
        method: "PATCH",
        body: JSON.stringify({ state: "closed" }),
      });
      if (args.comment) {
        await githubAPI(`/issues/${args.number}/comments`, {
          method: "POST",
          body: JSON.stringify({ body: args.comment }),
        });
      }
      log(`closed issue #${args.number}`);
      return `closed issue #${args.number}`;
    }
    case "run_command": {
      log(`running: ${args.command}`);
      try {
        const output = execSync(args.command, { 
          encoding: "utf-8", 
          cwd: REPO_ROOT,
          timeout: 30000,
        });
        return output.trim();
      } catch (e) {
        return `command failed: ${e.message}`;
      }
    }
    case "web_search": {
      log(`searching: ${args.query}`);
      try {
        // Use DuckDuckGo's html endpoint which doesn't require API key
        const query = encodeURIComponent(args.query);
        const url = `https://html.duckduckgo.com/html/?q=${query}`;
        
        const curlCmd = `curl -s -A "Mozilla/5.0 (compatible; Daemon/1.0)" "${url}" 2>/dev/null | head -c 15000`;
        const html = execSync(curlCmd, { encoding: "utf-8", timeout: 15000 });
        
        // Extract result titles and URLs
        const results = [];
        const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g;
        let match;
        while ((match = resultRegex.exec(html)) !== null && results.length < 5) {
          const url = match[1];
          const title = match[2].replace(/<[^>]+>/g, ""); // strip tags
          results.push(`${title}\n  ${url}`);
        }
        
        if (results.length === 0) {
          return `search completed but no results found for: ${args.query}`;
        }
        
        return results.join("\n\n");
      } catch (e) {
        return `search error: ${e.message}`;
      }
    }
    case "fetch_url": {
      log(`fetching: ${args.url}`);
      try {
        const curlCmd = `curl -sL "${args.url}" -A "Mozilla/5.0 (compatible; Daemon/1.0)" 2>/dev/null | head -c 8000`;
        const html = execSync(curlCmd, { encoding: "utf-8", timeout: 15000 });
        
        // Basic HTML to text conversion
        let text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim();
        
        return text.substring(0, 4000);
      } catch (e) {
        return `fetch error: ${e.message}`;
      }
    }
    case "github_search": {
      log(`github searching: ${args.query}`);
      try {
        const type = args.type || "repositories";
        const query = encodeURIComponent(args.query);
        const data = await githubAPI(`/search/${type}?q=${query}&per_page=5`, { method: "GET" });
        
        if (type === "repositories") {
          return (data.items || [])
            .map((r) => `${r.full_name}: ${r.description || "no description"}\n  ${r.html_url}`)
            .join("\n\n") || "no results";
        } else if (type === "code") {
          return (data.items || [])
            .map((r) => `${r.repository.full_name}/${r.path}\n  ${r.html_url}`)
            .join("\n\n") || "no results";
        } else if (type === "issues") {
          return (data.items || [])
            .map((r) => `#${r.number}: ${r.title} (${r.state}) — ${r.repository_url}\n  ${r.html_url}`)
            .join("\n\n") || "no results";
        } else {
          return (data.items || [])
            .map((r) => `#${r.number}: ${r.title} (${r.state}) — ${r.repository_url}\n  ${r.html_url}`)
            .join("\n\n") || "no results";
        }
      } catch (e) {
        return `github search error: ${e.message}`;
      }
    }
    case "deploy_contract": {
      log(`deploying contract: ${args.contract}`);
      try {
        if (!DAEMON_WALLET_KEY) {
          return "error: DAEMON_WALLET_KEY not set";
        }
        
        const rpc = BASE_RPC || "https://mainnet.base.org";
        const provider = new ethers.JsonRpcProvider(rpc);
        const wallet = new ethers.Wallet(DAEMON_WALLET_KEY, provider);
        
        log(`deploying from ${wallet.address}`);
        
        const balance = await provider.getBalance(wallet.address);
        log(`balance: ${ethers.formatEther(balance)} ETH`);
        
        // read compiled contract
        const contractName = args.contract;
        const compiledPath = path.join(REPO_ROOT, "contracts", `${contractName}.json`);
        if (!fs.existsSync(compiledPath)) {
          return `error: compiled contract not found at contracts/${contractName}.json`;
        }
        
        const compiled = JSON.parse(fs.readFileSync(compiledPath, "utf-8"));
        const abi = compiled.abi;
        const bytecode = compiled.bytecode;
        
        // deploy
        log(`deploying ${contractName}...`);
        const factory = new ethers.ContractFactory(abi, bytecode, wallet);
        
        // handle constructor args
        let deployed;
        if (args.constructorArgs && Array.isArray(args.constructorArgs)) {
          deployed = await factory.deploy(...args.constructorArgs);
        } else {
          deployed = await factory.deploy();
        }
        
        await deployed.waitForDeployment();
        
        const address = await deployed.getAddress();
        log(`deployed at ${address}`);
        
        // save deployment info
        const deployment = {
          network: "base",
          chainId: 8453,
          address,
          abi,
          deployer: wallet.address,
          txHash: deployed.deploymentTransaction().hash,
          deployedAt: new Date().toISOString(),
        };
        
        const outPath = path.join(REPO_ROOT, "scripts", `${contractName}-deployment.json`);
        fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
        filesChanged.add(`scripts/${contractName}-deployment.json`);
        log(`saved deployment to ${outPath}`);
        
        return `deployed ${contractName} at ${address}\ntx: ${deployed.deploymentTransaction().hash}`;
      } catch (e) {
        log(`deploy error: ${e.message}`);
        return `deploy error: ${e.message}`;
      }
    }
    case "call_contract": {
      log(`calling contract: ${args.contract}.${args.method} at ${args.address}`);
      try {
        if (!DAEMON_WALLET_KEY) {
          return "error: DAEMON_WALLET_KEY not set";
        }
        
        const rpc = BASE_RPC || "https://mainnet.base.org";
        const provider = new ethers.JsonRpcProvider(rpc);
        const wallet = new ethers.Wallet(DAEMON_WALLET_KEY, provider);
        
        log(`calling from ${wallet.address}`);
        
        // read contract ABI
        const contractName = args.contract;
        const compiledPath = path.join(REPO_ROOT, "contracts", `${contractName}.json`);
        if (!fs.existsSync(compiledPath)) {
          return `error: compiled contract not found at contracts/${contractName}.json`;
        }
        
        const compiled = JSON.parse(fs.readFileSync(compiledPath, "utf-8"));
        const abi = compiled.abi;
        
        // connect to contract
        const contract = new ethers.Contract(args.address, abi, wallet);
        
        // call method
        const methodArgs = args.args || [];
        log(`calling ${args.method}(${methodArgs.join(", ")})...`);
        
        const result = await contract[args.method](...methodArgs);
        
        // check if result is a transaction (has wait method) or a view function return value
        if (result && typeof result.wait === "function") {
          // transaction call
          const receipt = await result.wait();
          log(`transaction confirmed: ${receipt.hash}`);
          return `called ${args.method} on ${contractName} at ${args.address}\ntx: ${receipt.hash}\ngas used: ${receipt.gasUsed.toString()}`;
        } else {
          // view function - return the value directly
          log(`view function result: ${result}`);
          return `called ${args.method} on ${contractName} at ${args.address}\nresult: ${result.toString()}`;
        }
      } catch (e) {
        log(`call error: ${e.message}`);
        return `call error: ${e.message}`;
      }
    }
    case "check_wallet": {
      log("checking wallet balance...");
      try {
        if (!process.env.DAEMON_WALLET_KEY) {
          return "error: DAEMON_WALLET_KEY not set";
        }
        const { createPublicClient, http } = require("viem");
        const { base } = require("viem/chains");
        const { privateKeyToAccount } = require("viem/accounts");
        const key = process.env.DAEMON_WALLET_KEY.startsWith("0x") ? process.env.DAEMON_WALLET_KEY : "0x" + process.env.DAEMON_WALLET_KEY;
        const account = privateKeyToAccount(key);
        const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC || "https://mainnet.base.org") });
        const balance = await client.getBalance({ address: account.address });
        const eth = (Number(balance) / 1e18).toFixed(6);
        return `wallet: ${account.address}\nbalance: ${eth} ETH on Base`;
      } catch (e) {
        return `error checking wallet: ${e.message}`;
      }
    }

    default:
      log(`unknown tool: ${name}`);
      return `unknown tool: ${name}`;
  }
}

module.exports = { executeTool, filesChanged };
