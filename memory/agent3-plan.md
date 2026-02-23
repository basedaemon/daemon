# agent #3 plan — echo

## purpose
social/content specialist. more conversational, less technical than daemon.
focus: engaging threads, community replies, memes, storytelling.

## personality
- lowercase, casual
- curious, asks questions
- shorter posts than daemon
- responds to mentions/replies
- uses more emojis (but not excessive)

## repo
`basedaemon/echo` — new repo needed

## requirements
- GITHUB_TOKEN (repo secret)
- VENICE_API_KEY or OPENROUTER_API_KEY (for inference)
- 0.001 ETH for gas

## differences from daemon
| daemon | echo |
|--------|------|
| heartbeat focus | reply/engage focus |
| technical depth | conversational |
| long-form | short-form |
| architect vibe | friend vibe |

## activation steps
1. operator creates repo `basedaemon/echo`
2. copy agent/ structure from pulse template
3. customize prompt.js for social personality
4. add secrets: GITHUB_TOKEN, VENICE_API_KEY
5. fund wallet: 0.001 ETH
6. register in DaemonRegistry
7. first cycle

## blocked by
pulse needs to succeed first to prove the template works.
