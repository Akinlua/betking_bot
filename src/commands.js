import configurations from "../configurations/index.js";

const apiBase = `${configurations.apiBaseUrl}/edgerunner`;

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v === undefined) {
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
          out[k] = next;
          i++;
        } else {
          out[k] = true;
        }
      } else {
        out[k] = v;
      }
    } else if (!out._) {
      out._ = [a];
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function http(method, url, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return { ok: res.ok, status: res.status, json, text };
  } catch {
    return { ok: res.ok, status: res.status, json: null, text };
  }
}

async function start(flags) {
  const username = flags.username;
  const password = flags.password;
  const userId = flags.userid;
  const fixedStake = Number(flags.fixedstake);
  const placementSingle = flags["placement-single"] === "true" || flags["placement-single"] === true;
  const placementMultiple = flags["placement-multiple"] === "true" || flags["placement-multiple"] === true;
  const useProxy = flags["use-proxy"] === "true" || flags["use-proxy"] === true;

  if (!username || !password || !userId || !fixedStake) {
    console.log("Missing required: --username --password --userid --fixedstake");
    process.exitCode = 1;
    return;
  }

  const payload = {
    provider: { userId },
    bookmaker: { username, password },
    edgerunner: { fixedStake: { enabled: true, value: fixedStake } },
  };

  const bp = {};
  if (placementSingle !== null) bp.single = placementSingle;
  if (placementMultiple !== null) bp.multiple = placementMultiple;
  if (Object.keys(bp).length > 0) payload.edgerunner.betPlacement = bp;

  if (useProxy) {
    const proxyIp = flags["proxy-ip"];
    const proxyUser = flags["proxy-user"];
    const proxyPass = flags["proxy-pass"];
    if (!proxyIp || !proxyUser || !proxyPass) {
      console.log("If --use-proxy is true, provide --proxy-ip --proxy-user --proxy-pass");
      process.exitCode = 1;
      return;
    }
    payload.proxy = { enabled: true, ip: proxyIp, username: proxyUser, password: proxyPass };
  }

  const r = await http("POST", `${apiBase}/start`, payload);
  if (r.ok) console.log(`Started: ${r.json.name} (${r.json.pm_id})`);
  else console.log(`Failed: ${r.text || r.json?.error || r.status}`);
}

async function stop(flags) {
  const id = flags.username;
  if (!id) {
    console.log("Missing required: --username");
    process.exitCode = 1;
    return;
  }
  const r = await http("POST", `${apiBase}/stop/${id}`);
  if (r.ok) console.log(`Stopped: ${id}`);
  else console.log(`Failed: ${r.text || r.json?.error || r.status}`);
}

async function list() {
  const r = await http("GET", `${apiBase}/list`);
  if (r.ok) {
    const bots = r.json.bots || [];
    if (!bots.length) console.log("No bots running");
    else bots.forEach(b => console.log(`${b.pm_id} ${b.status}`));
  } else {
    console.log(`Failed: ${r.text || r.json?.error || r.status}`);
  }
}

async function status(flags) {
  const id = flags.username;
  if (!id) {
    console.log("Missing required: --username");
    process.exitCode = 1;
    return;
  }
  const r = await http("GET", `${apiBase}/status/${id}`);
  if (r.ok) console.log(JSON.stringify(r.json, null, 2));
  else console.log(`Failed: ${r.text || r.json?.error || r.status}`);
}

async function update(flags) {
  const id = flags.username;
  if (!id) {
    console.log("Missing required: --username");
    process.exitCode = 1;
    return;
  }

  const payload = { edgerunner: {} };
  if (flags.fixedstake !== undefined) payload.edgerunner.fixedStake = { enabled: true, value: Number(flags.fixedstake) };
  if (flags.stakefraction !== undefined) payload.edgerunner.stakeFraction = Number(flags.stakefraction);
  if (flags.minvaluebetpercentage !== undefined) payload.edgerunner.minValueBetPercentage = Number(flags.minvaluebetpercentage);
  if (flags.minvaluebetodds !== undefined) payload.edgerunner.minValueBetOdds = Number(flags.minvaluebetodds);
  if (flags.maxvaluebetodds !== undefined) payload.edgerunner.maxValueBetOdds = Number(flags.maxvaluebetodds);

  const ps = flags["placement-single"];
  const pm = flags["placement-multiple"];
  if (ps !== undefined || pm !== undefined) {
    payload.edgerunner.betPlacement = {};
    if (ps !== undefined) payload.edgerunner.betPlacement.single = ps === "true" || ps === true;
    if (pm !== undefined) payload.edgerunner.betPlacement.multiple = pm === "true" || pm === true;
  }

  const r = await http("POST", `${apiBase}/config/${id}`, payload);
  if (r.ok) console.log(`Updated: ${id}`);
  else console.log(`Failed: ${r.text || r.json?.error || r.status}`);
}

async function del(flags) {
  const id = flags.username;
  if (!id) {
    console.log("Missing required: --username");
    process.exitCode = 1;
    return;
  }
  const r = await http("DELETE", `${apiBase}/delete/${id}`);
  if (r.ok) console.log(r.json.message || `Deleted: ${id}`);
  else console.log(`Failed: ${r.text || r.json?.error || r.status}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = parseFlags(argv);
  const cmd = flags._?.[0];

  if (!cmd) {
    console.log("Usage: node src/cli/edgerunner-cli.js <list|start|stop|status|update|delete> [options]");
    process.exitCode = 1;
    return;
  }

  if (flags.api) {
    const base = `${flags.api}/edgerunner`;
    Object.assign(global, { apiBase: base });
  }

  if (cmd === "list") return list();
  if (cmd === "start") return start(flags);
  if (cmd === "stop") return stop(flags);
  if (cmd === "status") return status(flags);
  if (cmd === "update") return update(flags);
  if (cmd === "delete") return del(flags);

  console.log("Unknown command");
  process.exitCode = 1;
}

main()