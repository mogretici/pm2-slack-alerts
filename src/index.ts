import pm2 from "pm2";
import axios from "axios";
import os from "os";

const hostname = os.hostname();
const eventTimers: Record<string, NodeJS.Timeout> = {};
const globalSlackUrl = process.env.PM2_SLACK_URL;
const eventFilterRaw = process.env.PM2_SLACK_EVENTS || "";
const defaultEvents = ["online", "exit", "stopped", "errored", "disconnected"];
const eventFilterList = eventFilterRaw
    ? eventFilterRaw.split(",").map(s => s.trim()).filter(Boolean)
    : defaultEvents;
const mentionsRaw = process.env.PM2_SLACK_MENTIONS || "";
const mentions = mentionsRaw
    .split(",")
    .map(id => id.trim())
    .filter(Boolean)
    .map(id => `<@${id}>`)
    .join(" ");

const filterRaw = process.env.PM2_SLACK_FILTER || "";
const filterList = filterRaw.split(",").map(s => s.trim()).filter(Boolean);

if (!globalSlackUrl) {
  console.error("[pm2-slack-alerts] Missing Slack URL. Set environment variable PM2_SLACK_URL.\nUsage Example: pm2 set pm2-slack-alerts:PM2_SLACK_URL https://hooks.slack.com/services/XXXXX/YYYYY/ZZZZZ\n");
  process.exit(1);
}

pm2.connect((err) => {
  if (err) {
    console.error("[pm2-slack-alerts] Failed to connect to PM2:", err);
    process.exit(2);
  }

  pm2.launchBus((err, bus) => {
    if (err) {
      console.error("[pm2-slack-alerts] Failed to launch PM2 bus:", err);
      process.exit(3);
    }

    const DEBOUNCE_MS = 2000;
    const restartFlags: Record<string, { exited: Set<number>, online: Set<number> }> = {};
    const timers: Record<string, NodeJS.Timeout> = {};

    bus.on("process:event", (data: any) => {
      const app = data.process?.name || "unknown-app";
      const id = data.process?.pm_id;
      const event = data.event;

      if (id === undefined) return;
      if (eventFilterList.length && !eventFilterList.includes(event)) return;
      if (filterList.length && !filterList.includes(app)) return;

      if (!restartFlags[app]) {
        restartFlags[app] = {
          exited: new Set<number>(),
          online: new Set<number>(),
        };
      }

      if (event === "exit") {
        restartFlags[app].exited.add(id);

        if (timers[app]) clearTimeout(timers[app]);
        timers[app] = setTimeout(() => {
          const { exited, online } = restartFlags[app];

          if (exited.size && online.size && online.size === exited.size) {
            sendSlackMessage(app, "restarted", `${app} has been restarted (${online.size} instance${online.size > 1 ? "s" : ""})`, [...online]);
          } else if (exited.size && online.size === 0) {
            sendSlackMessage(app, "stopped", `${app} has been stopped (${exited.size} instance${exited.size > 1 ? "s" : ""})`, [...exited]);
          }

          restartFlags[app] = { exited: new Set(), online: new Set() };
        }, DEBOUNCE_MS);
      }

      else if (event === "online") {
        restartFlags[app].online.add(id);

        if (timers[app]) clearTimeout(timers[app]);
        timers[app] = setTimeout(() => {
          const { exited, online } = restartFlags[app];

          if (exited.size && online.size && online.size === exited.size) {
            sendSlackMessage(app, "restarted", `${app} has been restarted (${online.size} instance${online.size > 1 ? "s" : ""})`, [...online]);
          } else if (online.size && exited.size === 0) {
            sendSlackMessage(app, "started", `${app} has been started (${online.size} instance${online.size > 1 ? "s" : ""})`, [...online]);
          }

          restartFlags[app] = { exited: new Set(), online: new Set() };
        }, DEBOUNCE_MS);
      }

      else if (["stopped", "errored", "disconnected"].includes(event)) {
        sendSlackMessage(app, event, `${app} is now ${event}`);
      }
      else if (
          ["log", "error", "kill", "exception", "reload", "delete", "restart overlimit",].includes(event)
      ) {
        const debounceKey = `${app}-${event}`;
        if (eventTimers[debounceKey]) return;

        eventTimers[debounceKey] = setTimeout(() => {
          delete eventTimers[debounceKey];
        }, 2000);

        sendSlackMessage(app, event, `${app} triggered ${event}`);
      }
    });

    function sendSlackMessage(app: string, event: string, text: string, pids: number[] = []) {
      pm2.describe(app, (err, descriptions) => {
        if (err || !descriptions || !descriptions.length) {
          console.error("[pm2-slack-alerts] Failed to get PM2 process description:", err);
          return;
        }

        const desc = descriptions[0];
        const monit = desc.monit || {};
        const uptime = desc.pm2_env?.pm_uptime
            ? `${Math.floor((Date.now() - desc.pm2_env.pm_uptime) / 1000)}s`
            : "N/A";
        const memory = monit.memory ? `${(monit.memory / 1024 / 1024).toFixed(2)} MB` : "N/A";
        const cpu = monit.cpu !== undefined ? `${monit.cpu}%` : "N/A";

        const colorMap: Record<string, string> = {
          restarted: "#4caf50",
          started: "#2196f3",
          stopped: "#f44336",
          errored: "#e53935",
          disconnected: "#ff9800",
          exit: "#f44336",
          log: "#607d8b",
          error: "#d32f2f",
          kill: "#9e9e9e",
          exception: "#ab47bc",
          reload: "#03a9f4",
          delete: "#757575",
          "restart overlimit": "#e91e63",
        };

        const emojiMap: Record<string, string> = {
          restarted: "♻️",
          started: "🚀",
          stopped: "🛑",
          errored: "❌",
          disconnected: "⚠️",
          exit: "🛑",
          log: "📝",
          error: "🐞",
          kill: "☠️",
          exception: "🔥",
          reload: "🔁",
          delete: "🗑️",
          "restart overlimit": "🚫",
        };

        const color = colorMap[event] || "#cccccc";
        const emoji = emojiMap[event] || "ℹ️";
        const now = new Date();
        const timestamp = Math.floor(now.getTime() / 1000);
        const formattedTime = now.toLocaleString("tr-TR", {
          timeZone: "Europe/Istanbul",
          hour12: false,
        });

        const pidLine = pids.length
            ? `🧩 PIDs       : ${pids.length} instance${pids.length > 1 ? "s" : ""} (${pids.join(", ")})`
            : "";

        const mentionsLine = mentions ? `👥 Mentions   : ${mentions}` : "";

        const messageText = [
          "```",
          `🕒 Time       : ${formattedTime}`,
          `🖥 Host       : ${hostname}`,
          `📌 Event      : ${event}`,
          `📊 Mode       : ${pids.length > 1 ? "cluster" : "fork"}`,
          `📈 Uptime     : ${uptime}`,
          `💾 Memory     : ${memory}`,
          `⚙️ CPU        : ${cpu}`,
          pidLine,
          mentionsLine,
          "```",
        ].filter(Boolean).join("\n");

        const slackUrlKey = `PM2_SLACK_URL_${app.replace(/-/g, "_").toUpperCase()}`;
        const appSlackUrl = process.env[slackUrlKey] || globalSlackUrl;

        axios.post(appSlackUrl!, {
          username: `PM2 Notify (${hostname})`,
          attachments: [
            {
              fallback: `${app} ${event}`,
              color,
              title: `${emoji} SERVER STATUS UPDATED ${emoji}`,
              text: "━━━━━━━━━━━━━━━━━━━━━━━━━━\n" + ` *${app.toUpperCase()}* → *\`${event.toUpperCase()}\`* \n\n` + messageText,
              ts: timestamp,
            },
          ],
        }).catch(console.error);
      });
    }
  });
});