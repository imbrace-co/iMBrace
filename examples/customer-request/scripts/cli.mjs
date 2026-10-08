// Drives the customer-request example: send a request, the customer's reply, approve, show the result.
// Node 18+, no dependencies, no state file: it looks the flows up by name through the gateway.
//
// From the CE stack (nothing else installed; deploy/docker-compose.yml, service "examples"):
//   docker compose run --rm examples request REQ-1001
// From a clone of the repo (defaults to the published ports on 127.0.0.1):
//   node scripts/cli.mjs request REQ-1001
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = (k, d) => process.env[k] ?? d;

const GATEWAY = env('IMBRACE_API', 'http://127.0.0.1:6868/api');
const EMAIL = env('IMBRACE_EMAIL', 'admin@imbrace.co');
const PASSWORD = env('IMBRACE_PASSWORD', 'ChangeMe@12345');
// Where this script reaches the workflow webhooks and the stub, and the public webhook base it prints.
const WORKFLOW = env('WORKFLOW_INTERNAL_URL', env('WORKFLOW_URL', 'http://127.0.0.1:30700'));
const WORKFLOW_PUBLIC = env('WORKFLOW_URL', 'http://127.0.0.1:30700');
const STUB = env('STUB_URL', 'http://127.0.0.1:30800');

const FLOWS = { intake: 'Customer request - intake', replyRouter: 'Customer request - reply router' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const show = (v) => console.log(JSON.stringify(v, null, 2));

async function call(method, path, { token, body, orgId } = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-access-token': token } : {}),
      ...(orgId ? { 'x-organization-id': orgId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

async function accessToken() {
  const login = await call('POST', '/platform/v1/login/sign_in', {
    body: { email: EMAIL, password: PASSWORD },
  });
  const orgs = await call('GET', '/platform/v2/organizations', { token: login.token });
  const org = orgs.data?.[0];
  if (!org) throw new Error('no organization found for this user');
  const fresh = await call('POST', '/platform/v1/login/sign_in', {
    body: { email: EMAIL, password: PASSWORD },
  });
  const acc = await call('POST', '/platform/v1/access/_exchange_access_token', {
    token: fresh.token,
    body: { organization_id: org.id },
  });
  return acc.token;
}

// { intake: id, replyRouter: id } of the two example flows.
async function flowIds() {
  const token = await accessToken();
  const existing = await call('GET', '/activepieces/v1/flows?limit=100', { token });
  const ids = {};
  for (const [key, name] of Object.entries(FLOWS)) {
    const flow = existing.data.find((f) => f.version?.displayName === name);
    if (!flow) throw new Error(`flow "${name}" not found: the example is not installed (see docker logs imbrace-examples-seed)`);
    ids[key] = flow.id;
  }
  return ids;
}

function payload(file, requestId) {
  return JSON.parse(readFileSync(join(root, 'payloads', file), 'utf8').replaceAll('__REQUEST_ID__', requestId));
}

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

async function stubCalls(path, requestId) {
  const q = new URLSearchParams({ ...(path ? { path } : {}), ...(requestId ? { request_id: requestId } : {}) });
  const res = await fetch(`${STUB}/calls?${q}`);
  return res.json();
}

// Latest stub call on <path> for <requestId>, waiting up to <seconds>.
async function waitForCall(path, requestId, seconds) {
  const deadline = Date.now() + seconds * 1000;
  for (;;) {
    const calls = await stubCalls(path, requestId);
    if (calls.length) return calls[calls.length - 1].body;
    if (Date.now() > deadline) return null;
    await sleep(2000);
  }
}

// The approval links carry the public workflow URL; call them through WORKFLOW (in-network inside the stack).
function viaWorkflow(url) {
  const u = new URL(url);
  return new URL(u.pathname + u.search, WORKFLOW).toString();
}

const commands = {
  async urls() {
    const ids = await flowIds();
    console.log(`intake (service request):  ${WORKFLOW_PUBLIC}/api/v1/webhooks/${ids.intake}`);
    console.log(`reply router (reply):      ${WORKFLOW_PUBLIC}/api/v1/webhooks/${ids.replyRouter}/sync`);
  },

  async request(requestId = `REQ-${Date.now()}`) {
    const ids = await flowIds();
    const res = await post(`${WORKFLOW}/api/v1/webhooks/${ids.intake}`, payload('request.json', requestId));
    console.log(`request_id: ${requestId}  (intake webhook -> HTTP ${res.status})`);
    console.log("waiting for the 'information required' message ...");
    const notify = await waitForCall('/notify', requestId, 180);
    if (!notify) {
      throw new Error(
        'no message within 180 s: the run stopped at a step. FlowOps -> Workflows -> Runs shows which one ' +
          '(often "Classify request (AI agent)": no LLM provider / AI agent yet, see docker logs imbrace-examples-seed).',
      );
    }
    show(notify);
    console.log(`\nThe run is now waiting. Send the reply:  reply ${requestId}`);
  },

  async reply(requestId) {
    if (!requestId) throw new Error('usage: reply <request_id>');
    const ids = await flowIds();
    const res = await post(`${WORKFLOW}/api/v1/webhooks/${ids.replyRouter}/sync`, payload('reply.json', requestId));
    show(res.body);
    console.log(`reply router -> HTTP ${res.status}${res.status === 202 ? '' : ' (no run is waiting for this request_id)'}`);
    if (res.status === 202) {
      console.log(`\nApprove in the dashboard (FlowOps -> Workflows -> More -> Todos), or:  approve ${requestId}`);
    }
  },

  async approve(requestId, decision = 'Approve') {
    if (!requestId) throw new Error('usage: approve <request_id> [Approve|Reject]');
    const task = await waitForCall('/approvals', requestId, 60);
    if (!task) throw new Error(`no approval task for ${requestId} yet (send the reply first)`);
    const link = task.links?.find((l) => l.name.toLowerCase() === decision.toLowerCase());
    if (!link) throw new Error(`decision must be one of: ${task.links.map((l) => l.name).join(', ')}`);
    const res = await fetch(viaWorkflow(link.url), { method: 'POST' });
    console.log(`approval (${link.name}) -> HTTP ${res.status}`);
    console.log(`\nSee what the business system received:  result ${requestId}`);
  },

  async result(requestId) {
    if (!requestId) throw new Error('usage: result <request_id>');
    const done = await waitForCall('/business-system', requestId, 30);
    if (done) {
      console.log('business system received:');
      show(done);
      return;
    }
    const notes = await stubCalls('/notify', requestId);
    const rejected = notes.find((c) => c.body?.approval);
    if (rejected) {
      console.log('rejected, the customer was told:');
      show(rejected.body);
    } else {
      console.log(`nothing for ${requestId} yet: is it approved? (calls ${requestId} lists every stub call)`);
    }
  },

  async calls(requestId) {
    show(await stubCalls(null, requestId));
  },

  help() {
    console.log(`customer-request example

  request [request_id]           post a service request with missing fields; prints the
                                 "information required" message (the run then waits)
  reply   <request_id>           post the customer's reply: HTTP 202 resumed, 404 nothing waiting
  approve <request_id> [Reject]  resolve the approval task (or use the Todos page)
  result  <request_id>           what the business system received
  calls   [request_id]           every call the stub recorded
  urls                           the two webhook URLs, to call them yourself`);
  },
};

const [name = 'help', ...args] = process.argv.slice(2);
const command = commands[name];
if (!command) {
  console.error(`unknown command "${name}"`);
  commands.help();
  process.exit(1);
}
Promise.resolve()
  .then(() => command(...args))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
