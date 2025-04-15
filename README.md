# pm2-slack-alerts

A PM2 module that sends formatted Slack notifications for process events like `start`, `stope`, `restart` and more — with support for clustering, user mentions, resource usage, and per-app webhook overrides.

---

## 🚀 Features

- Detects `online`, `exit`, `stopped`, `errored`, `disconnected` ... events
- Smart event debouncing (no duplicate messages)
- Includes uptime, memory, and CPU stats
- Supports Slack user mentions
- Per-app Slack Webhook URL overrides
- Cluster-aware PID tracking

---

## 🛠 Installation

```bash
pm2 install pm2-slack-alerts
```

---

## ⚙️ Configuration

### Global Slack Webhook

Set the default Slack webhook URL:

```bash
pm2 set pm2-slack-alerts:PM2_SLACK_URL https://hooks.slack.com/services/XXXXX/YYYYY/ZZZZZ
```

### User Mentions

To tag users in Slack messages:

---
```bash
pm2 set pm2-slack-alerts:PM2_SLACK_MENTIONS "U01234567,U07654321"
```
🔎 How to Find Slack User IDs
1.	Click on the user’s profile in Slack
2.	In the top right corner of the profile pop-up, click the vertical three dots (︙)
3.	Select “Copy member ID” from the dropdown
4.	Paste the ID into your config (e.g., U01234567)

> This will automatically convert to `<@U01234567> <@U07654321>` format in messages.
---


### Per-App Webhook (Optional)

You can override the global webhook for a specific app.  
If your app is named `important-project`, use:

```bash
pm2 set pm2-slack-alerts:PM2_SLACK_URL_IMPORTANT_PROJECT https://hooks.slack.com/services/XXXXX/YYYYY/ZZZZZ
```

> App names are transformed to uppercase and dashes are replaced with underscores.

---

### Process Filtering (Optional)
Only receive notifications from specific apps:

```bash
pm2 set pm2-slack-alerts:PM2_SLACK_FILTER api-service,worker
```
-	Case-sensitive.
-	If unset, all PM2 apps will be monitored.
-	Useful for large PM2 environments with many apps.

---

### Event Filtering (Optional)

Control which PM2 events send Slack notifications:

```bash
pm2 set pm2-slack-alerts:PM2_SLACK_EVENTS restart,errored,exit
```

- If **unset**, only the following essential events are enabled by default:
    - `online`
    - `exit`
    - `stopped`
    - `errored`
    - `disconnected`
- To enable additional events like `log`, `error`, or `kill`, explicitly define them in `PM2_SLACK_EVENTS`.
- If unset, all supported PM2 events will trigger a Slack notification.
- Common events: start, stop, restart, exit, online, errored, disconnected

---
## 📡 Supported PM2 Events

The following PM2 events are supported and can be filtered using the `PM2_SLACK_EVENTS` environment variable:

- `online`
- `exit`
- `stopped`
- `errored`
- `disconnected`
- `log`
- `error`
- `kill`
- `exception`
- `reload`
- `delete`
- `restart overlimit`

Each message includes:
- Event emoji
- Hostname
- App name
- Event type
- Mode (`cluster` or `fork`)
- PID list
- Uptime, Memory, CPU
- Mentions (if defined)

---

## 🧪 Slack Message Example

```
🚀 SERVER STATUS UPDATED 🚀

━━━━━━━━━━━━━━━━━━━━━━━━━━
 IMPORTANT_PROJECT → STARTED

🕒 Time       : 2025-04-15 14:03:22
🖥 Host       : dev-machine.local
📌 Event      : started
📊 Mode       : cluster
📈 Uptime     : 22s
💾 Memory     : 48.12 MB
⚙️ CPU        : 1%
🧩 PIDs       : 4 instances (0, 1, 2, 3)
👥 Mentions   : <@U01234567> <@U07654321>
```
---
## 🤝 Contributing
- We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) for details on how to get started.
---

## 🧾 License

MIT
