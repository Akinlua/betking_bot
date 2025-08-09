// import pm2 from "pm2";
// import fs from "fs/promises";
// import path from "path";
// import { fileURLToPath } from "url";
// import { v4 as uuidv4 } from "uuid";
// import chalk from "chalk";
//
// const __dirname = path.dirname(fileURLToPath(import.meta.url));
//
// export async function startBot(req, res) {
//   const config = req.body;
//   const botId = uuidv4();
//   const configPath = path.join(__dirname, `../../configs/${botId}.json`);
//   try {
//     // Validate config
//     if (!config.provider || !config.bookmaker || !config.edgeRunner) {
//       return res.status(400).json({ error: "Invalid configuration: provider, bookmaker, and edgeRunner required" });
//     }
//     await fs.mkdir(path.dirname(configPath), { recursive: true });
//     await fs.writeFile(configPath, JSON.stringify(config, null, 2));
//     await new Promise((resolve, reject) => {
//       pm2.start({
//         script: path.join(__dirname, "../botRunner.js"),
//         name: `edgerunner-${botId}`,
//         env: { CONFIG_PATH: configPath }
//       }, (err, proc) => {
//         if (err) return reject(err);
//         resolve(proc);
//       });
//     });
//     res.json({ message: "Bot started", pm_id: botId, name: `edgerunner-${botId}` });
//   } catch (error) {
//     console.error('[Bot] Failed to start bot:', error);
//     res.status(500).json({ error: "Failed to start bot" });
//   }
// }
//
// export async function updateConfig(req, res) {
//   const pm_id = req.params.id;
//   const { fixedStake, stakeFraction, minValueBetPercentage } = req.body;
//   try {
//     await new Promise((resolve, reject) => {
//       pm2.list((err, processes) => {
//         if (err) return reject(err);
//         const proc = processes.find(p => p.name === `edgerunner-${pm_id}`);
//         if (!proc) return reject(new Error("Bot not found"));
//         pm2.sendDataToProcessId(proc.pm2_env.pm_id, {
//           type: 'config',
//           data: { config: { fixedStake, stakeFraction, minValueBetPercentage } }
//         }, (err) => {
//           if (err) return reject(err);
//           resolve();
//         });
//       });
//     });
//     res.json({ message: "Bot configuration updated", pm_id });
//   } catch (error) {
//     console.error('[Bot] Failed to update configuration:', error);
//     res.status(400).json({ error: "Invalid configuration update" });
//   }
// }
//
// export async function stopBot(req, res) {
//   const pm_id = req.params.id;
//   try {
//     await new Promise((resolve, reject) => {
//       pm2.list((err, processes) => {
//         if (err) return reject(err);
//         const proc = processes.find(p => p.name === `edgerunner-${pm_id}`);
//         if (!proc) return reject(new Error("Bot not found"));
//         pm2.sendDataToProcessId(proc.pm2_env.pm_id, { type: 'stop' }, (err) => {
//           if (err) return reject(err);
//           pm2.delete(proc.pm2_env.pm_id, (err) => {
//             if (err) return reject(err);
//             resolve();
//           });
//         });
//       });
//     });
//     await fs.unlink(path.join(__dirname, `../../configs/${pm_id}.json`)).catch(() => {});
//     res.json({ message: "Bot stopped", pm_id });
//   } catch (error) {
//     console.error('[Bot] Failed to stop bot:', error);
//     res.status(400).json({ error: "Failed to stop bot" });
//   }
// }
//
// export async function listBots(req, res) {
//   try {
//     const bots = await new Promise((resolve, reject) => {
//       pm2.list((err, processes) => {
//         if (err) return reject(err);
//         resolve(processes.filter(p => p.name.startsWith('edgerunner-')).map(p => ({
//           pm_id: p.pm2_env.pm_id,
//           name: p.name,
//           status: p.pm2_env.status
//         })));
//       });
//     });
//     res.json({ bots });
//   } catch (error) {
//     console.error('[Bot] Failed to list bots:', error);
//     res.status(500).json({ error: "Failed to list bots" });
//   }
// }
//
// export async function getBotStatus(req, res) {
//   const pm_id = req.params.id;
//   try {
//     const status = await new Promise((resolve, reject) => {
//       pm2.list((err, processes) => {
//         if (err) return reject(err);
//         const proc = processes.find(p => p.name === `edgerunner-${pm_id}`);
//         if (!proc) return reject(new Error("Bot not found"));
//         pm2.sendDataToProcessId(proc.pm2_env.pm_id, { type: 'status' }, (err, response) => {
//           if (err) return reject(err);
//           resolve(response?.data?.status || { status: proc.pm2_env.status });
//         });
//       });
//     });
//     res.json({ message: "Bot status", pm_id, ...status });
//   } catch (error) {
//     console.error('[Bot] Failed to get bot status:', error);
//     res.status(400).json({ error: "Failed to get bot status" });
//   }
// }
