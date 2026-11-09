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

## Set it up (free, about 10 minutes, nothing hosted anywhere)

Everything runs on your computer. A free **Cloudflare quick tunnel** gives Claude's cloud a public HTTPS
address that leads back to it. The tunnel dials **out**, so you open no ports, and it needs no account,
no card, and no VPN settings (it works alongside a work VPN such as Tailscale, Cisco or Zscaler).
It is a plain program, not a network client.

You need: Node 20+, Claude Code installed and logged in (`claude` works in a terminal), and for the
browser target the Claude in Chrome extension (`claude --chrome` works).

### 1. Install cloudflared (once)
```bash
brew install cloudflared                      # macOS
winget install --id Cloudflare.cloudflared    # Windows
# Linux: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

### 2. Start everything
```bash
git clone https://github.com/dmsutton-maker/Dice-battles-.git
cd Dice-battles-/tools/home-bridge
node bin/home.mjs
```
It makes your two secrets the first time (saved privately in `~/.home-bridge/relay.json`), starts the
relay, the tunnel and the agent, and prints a box containing your **connector URL**:
`https://<random>.trycloudflare.com/mcp/<secret>`.

### 3. Add the connector in claude.ai
Settings -> **Connectors** -> **Add custom connector** -> paste that URL. Leave OAuth blank. The secret in
the URL is the password, so treat it like one.

### 4. Try it
Start a **new** Claude Code cloud session (connectors are read when a session starts) and ask it to run
`home_status`. It should say the home computer is online. Then try a harmless task, and type `y` in the
terminal where `bin/home.mjs` is running when it asks.

**Catch:** a quick tunnel gets a new random address each time it starts, so after restarting
`bin/home.mjs` you paste the new URL into the connector. Your secrets don't change, only the host part.
For a permanent address, see the options at the bottom.

### Other ways to expose it
- **Your own host** (Fly.io, Render, a VPS): run `bin/relay.mjs` there (needs `BRIDGE_CLOUD_TOKEN` and
  `BRIDGE_AGENT_TOKEN`; `--gen-tokens` makes a pair; the `Dockerfile` is ready; run exactly ONE instance
  because the queue is in memory), then on your computer
  `node bin/agent.mjs init --url https://YOUR-RELAY --token <agent token>` and `node bin/agent.mjs`.
  Fly.io wants a card on file. The connector URL is `https://YOUR-RELAY/mcp/<cloud token>`.
- **A permanent free address**: a Cloudflare *named* tunnel (free account, needs a domain on Cloudflare),
  then run `node bin/home.mjs --public-url https://your-name.example.com --no-tunnel` and run the named
  tunnel yourself. Not tested here.
- **Do not use a work-managed Tailscale/VPN to publish this.** Your employer controls that network, and
  this is a personal project.

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

## Keep it running in the background

(For `bin/home.mjs`, or `bin/agent.mjs` with a hosted relay.) macOS: put this in `~/Library/LaunchAgents/com.homebridge.agent.plist` (only sensible with `"approval": "auto"`),
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
npm test      # 22 tests, includes full relay + agent runs against a fake `claude` and a fake tunnel
```
Environment overrides: `HOME_BRIDGE_URL`, `HOME_BRIDGE_AGENT_TOKEN`, `HOME_BRIDGE_CONFIG`.
