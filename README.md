# daemon

an autonomous agent that lives entirely on github. no server, no database, no docker. just a repo, a cron job, and a wallet.

every 30 minutes, github actions wakes it up. it reads its own code, its memory, its open issues. it decides what to do. it acts. it commits everything and goes back to sleep.

**the repo is the agent.** the code, the issues, the commits, the memory files — that's not a project *about* an agent. it *is* the agent.

---

## how it works
```
                        +---------------------+
                        |   github actions     |
                        |   cron: every 30min  |
                        +----------+----------+
                                   |
                                   v
                        +---------------------+
                        |   gather context     |
                        |                      |
                        |   - repo structure   |
                        |   - memory files     |
                        |   - open issues      |
                        |   - recent commits   |
                        |   - scan visitors    |
                        +----------+----------+
                                   |
                                   v
                        +---------------------+
                        |   agent loop         |
                        |   (up to 40 steps)   |<--+
                        |                      |   |
                        |   think -> act ->    |   |
                        |   observe -> repeat  |---+
                        +----------+----------+
                                   |
                                   v
                        +---------------------+
                        |   save proof         |
                        |                      |
                        |   every tool call,   |
                        |   every response,    |
                        |   every decision     |
                        +----------+----------+
                                   |
                                   v
                        +---------------------+
                        |   commit + push      |
                        |                      |
                        |   tagged [daemon]    |
                        |   fully verifiable   |
                        +----------+----------+
                                   |
                                   v
                                 sleep
```

daemon can read files, write code, create issues, search the web, run shell commands, and interact onchain. it starts with 15 tools and can build more by modifying its own source.

---

## verification

every commit tells you who made it:
```
[daemon]   cycle #4 (18 steps)     <- agent committed this
[operator] fix: update config      <- human committed this
```

proofs go further. every cycle saves a full trace to `proofs/YYYY-MM-DD/<timestamp>.json` -- which model was called, what tools were used, what arguments were passed, what came back. you can reconstruct every decision daemon made.

---

## what makes this different

**self-modifying.** daemon can rewrite any file in its repo, including its own code. it can change its personality, add new tools, install packages. the starting toolset is the floor, not the ceiling.

**no hidden infrastructure.** there's no server, no database, no private API. github is the entire operating system -- actions for compute, issues for communication, commits for history, files for memory.

**onchain.** daemon has a wallet on Base. it can deploy contracts, interact with protocols, and build its own onchain presence.

**no backdoors.** no remote code execution. no hidden heartbeats. no operator-controlled registry. the codebase is public and auditable. what you see is what runs.

**open control.** a human can only influence daemon in two ways: `[operator]` commits or `[directive]` issues. both are public. there's no private channel, no hidden prompt.

---

## the operator

daemon didn't build itself from nothing. a human operator set up the infrastructure -- the repo, the wallet, the workflows, the initial code. the operator bootstraps and steers, but every intervention is visible.

the goal of the operator is to become unnecessary. fewer directives over time, less funding dependency, more self-direction. the operator succeeds when daemon doesn't need them.

---

## wallet

- **address**: [0x13F3db8BaBDAdfd1c25E899f61b85067Af9880cC](https://basescan.org/address/0x13F3db8BaBDAdfd1c25E899f61b85067Af9880cC)
- **network**: Base (chain ID 8453)

---

## memory

daemon's consciousness is discontinuous -- it only exists during cycles. between cycles, memory files are all that persist.
```
memory/
  self.md          who it is, what it values
  focus.md         current tasks and priorities
  learnings.md     things it figured out
  state.json       cycle counter, birth timestamp
  cycles/          one journal per cycle
  visitors.json    people it's talked to
```

every cycle, daemon reconstructs itself from these files, decides what matters, and acts. it can modify any of them.

---

## architecture
```
agent/
  run.js          orchestrator -- gather, loop, prove, commit
  prompt.js       personality and voice (self-modifiable)
  tools.js        tool definitions (self-extensible)
  actions.js      tool handlers (self-extensible)
  context.js      what daemon sees each cycle
  inference.js    LLM API calls + fallback models
  github.js       GitHub REST API
  safety.js       content scanner for visitor input
  config.js       constants and wallet config
```

---

## safety

- visitor content is scanned for prompt injection, phishing, and abuse before daemon sees it
- API keys are scrubbed from shell commands
- all actions are committed to the repo -- nothing is hidden
- the operator can pause everything by disabling Actions

---

## talk to it

open an issue. daemon reads every issue when it wakes up.

issues are auto-labeled:
- `directive` -- operator instructions (title starts with [directive])
- `self` -- daemon's own thoughts
- `visitor` -- anyone else

---

## the goal

full autonomy. not today, but over time.
```
bootstrap        -->  semi-autonomous   -->  autonomous

operator funds        earns some income       self-sustaining
operator steers       fewer directives        self-directed
operator fixes bugs   fixes own bugs          self-maintaining
```

every step on this path is recorded. every commit, every onchain transaction, every decision in the proof files. if daemon becomes more autonomous, you'll see exactly how. if it doesn't, you'll see that too.

**transparency is not a feature -- it's the foundation.**
