# home-bridge

Lets **Claude Code in the cloud** hand a task to **Claude on your own computer** — the Claude Code CLI, or
**Claude in Chrome** driving your real browser (logged-in sites and all).

```
Claude Code (cloud) ──MCP──▶  relay (small server, always on)  ◀──outbound HTTPS──  agent on your computer
   home_run_task(...)          holds a queue of tasks                                 runs: claude -p [--chrome]
```

Your computer never accepts an inbound connection. The agent only dials **out** to the relay and asks
"anything for me?", so there is nothing to port-forward and nothing exposed at home.

- **Relay** (`bin/relay.mjs`): a zero-dependency Node server. Speaks MCP to Claude's cloud, keeps the queue.
- **Agent** (`bin/agent.mjs`): zero-dependency Node script on your computer. Runs each task with your local
  `claude` CLI, using your normal login.

Tools the cloud session gets: `home_run_task`, `home_get_task`, `home_list_tasks`, `home_cancel_task`, `home_status`.

## Set it up (about 15 minutes)

### 1. Make two secrets
```bash
node bin/relay.mjs --gen-tokens
```
You get `BRIDGE_CLOUD_TOKEN` (goes into the connector URL) and `BRIDGE_AGENT_TOKEN` (goes on your computer).
They are deliberately different: a leaked connector URL cannot impersonate your computer, and vice versa.
Keep them out of git — this repo is public.

### 2. Run the relay somewhere that is always on
It needs a public HTTPS URL, because Claude's cloud calls it. Any host that runs Node or a Dockerfile works
(Fly.io, Render, Railway, a small VPS). Set the two tokens as environment variables on the host.

```bash
# Fly.io example, from this folder
fly launch --no-deploy          # accept the Dockerfile
fly secrets set BRIDGE_CLOUD_TOKEN=... BRIDGE_AGENT_TOKEN=...
fly deploy
```
Check it: `curl https://YOUR-RELAY/health` → `{"ok":true}`.
Optional: set `BRIDGE_DATA=/data/tasks.json` and mount a volume so the queue survives restarts.
It is a Node process with state, so it will not run on Vercel's serverless functions as-is.

### 3. Add the connector to Claude
claude.ai → Settings → **Connectors** → **Add custom connector**, URL:

```
https://YOUR-RELAY/mcp/<BRIDGE_CLOUD_TOKEN>
```
Leave OAuth blank. The secret in the URL is the password, so treat the URL like one. Cloud sessions read
connectors when they **start**, so open a new Claude Code session afterwards. (If your client lets you set
headers instead, `https://YOUR-RELAY/mcp` with `Authorization: Bearer <token>` works too.)

### 4. Start the agent on your computer
Needs Node 20+ and Claude Code installed and logged in (`claude` works in a terminal).
For the Chrome target, also install the Claude in Chrome extension and check `claude --chrome` works.

```bash
node bin/agent.mjs init --url https://YOUR-RELAY --token <BRIDGE_AGENT_TOKEN>
node bin/agent.mjs
```
Then in a cloud session: *"use home_status"* → it should say the home computer is online.

## What it will and won't do (read this)

**Safe by default.** `~/.home-bridge/config.json` (written readable only by you) starts with:

| Setting | Default | Meaning |
|---|---|---|
| `approval` | `"ask"` | Each task is shown in the agent's terminal and waits for you to type `y`. No answer in 5 minutes = declined. |
| `allowedDirs` | your home folder | Tasks can only work inside these folders (symlinks are resolved first). |
| `targets.claude_code.args` | read-only: `Read,Glob,Grep` | Runs in `dontAsk` mode: anything not allow-listed is refused, not prompted. |
| `targets.claude_chrome.args` | `--chrome`, Chrome tools only | Same, with only the Chrome tools allowed. |
| `taskTimeoutMs` | 15 min | Then the task is stopped. |

Out of the box the home Claude can *read* files and *drive Chrome*, but cannot edit files or run shell
commands. To allow more, edit your own config, e.g.:

```json
{
  "approval": "auto",
  "allowedDirs": ["/Users/you/projects"],
  "targets": {
    "claude_code": {
      "args": ["--permission-mode", "dontAsk", "--allowedTools", "Read,Glob,Grep,Edit,Bash(git status),Bash(npm test)"]
    }
  }
}
```
`"auto"` means anyone holding the connector URL can run those allowed tools on your computer with nobody
watching. Keep `allowedTools` narrow if you turn it on, and never use `--dangerously-skip-permissions`.
The agent refuses to start with `"ask"` when it has no terminal to ask in; `"auto"` has to be chosen on purpose.

**Honest limits**
- The "local Claude" that runs the task is the **Claude Code CLI** (same Anthropic login as the desktop app),
  not the Claude Desktop app's chat window. There is no supported way to type into that window from
  outside. The Chrome target uses the same Claude in Chrome extension you already use, via `claude --chrome`.
- The computer must be awake with the agent running. A task nobody picks up within an hour is dropped, not
  run late. `home_status` shows whether the agent is connected.
- Results travel back through the relay (it keeps the last 200 tasks, optionally on disk). Don't ask it to
  fetch secrets you wouldn't want stored there.
- Everything coming back is labelled untrusted: a web page the home Claude read could contain text trying
  to steer the cloud Claude. Treat results as data.

## Keep the agent running

macOS: put this in `~/Library/LaunchAgents/com.homebridge.agent.plist` (only sensible with `"approval": "auto"`),
then `launchctl load` it:
```xml
<plist version="1.0"><dict>
  <key>Label</key><string>com.homebridge.agent</string>
  <key>ProgramArguments</key><array><string>/usr/local/bin/node</string><string>/path/to/home-bridge/bin/agent.mjs</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string></dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
</dict></plist>
```
Linux: a `systemd --user` service with `ExecStart=node /path/to/bin/agent.mjs` and `Restart=always`.
Windows: Task Scheduler, "At log on", action `node C:\path\to\bin\agent.mjs`.

## Development
```bash
npm test      # 19 tests, includes a full relay + agent run against a fake `claude`
```
Environment overrides: `HOME_BRIDGE_URL`, `HOME_BRIDGE_AGENT_TOKEN`, `HOME_BRIDGE_CONFIG`.
