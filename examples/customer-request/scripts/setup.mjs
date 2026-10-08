// Imports the example flows into iMBrace Workflow, publishes and enables them.
// Node 18+, no dependencies. Writes the webhook URLs to scripts/.state.json.
//
//   node scripts/setup.mjs                 create the AI agent, import (or update) both flows
//   node scripts/setup.mjs --state-only    only look the flows up and write .state.json
//
// The CE stack (deploy/docker-compose.yml) runs it as the examples-seed service with
//   --seed           never overwrite a flow that already exists, do not write .state.json;
//                    SEED_EXAMPLES=false makes it exit without doing anything
//   --wait-api       retry until the stack answers (fresh install)
//   --wait-provider  without an LLM provider, import the flows anyway, then check every
//                    30 s and create the AI agent as soon as a provider is added
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const env = (k, d) => process.env[k] ?? d;
const flags = new Set(process.argv.slice(2));
const SEED = flags.has('--seed');
const WAIT_API = flags.has('--wait-api');
const WAIT_PROVIDER = flags.has('--wait-provider');
const STATE_ONLY = flags.has('--state-only');

const GATEWAY = env('IMBRACE_API', 'http://127.0.0.1:6868/api');
const WORKFLOW_PUBLIC = env('WORKFLOW_URL', 'http://127.0.0.1:30700');
const EMAIL = env('IMBRACE_EMAIL', 'admin@imbrace.co');
const PASSWORD = env('IMBRACE_PASSWORD', 'ChangeMe@12345');

const CLASSIFIER_PROVIDER_TYPE = env('CLASSIFIER_PROVIDER_TYPE', 'bedrock');
const CLASSIFIER_MODEL = env('CLASSIFIER_MODEL', 'qwen.qwen3-32b-v1:0');
const CLASSIFIER_PLACEHOLDER = '__CLASSIFIER_ASSISTANT_ID__';

const FLOWS = [
  { key: 'intake', file: 'flows/intake.json' },
  { key: 'replyRouter', file: 'flows/reply-router.json' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  return { token: acc.token, organizationId: org.id };
}

// Login plus the workflow project of the organization.
async function session() {
  const { token, organizationId } = await accessToken();
  const me = await call('GET', '/activepieces/v1/users/me', { token });
  if (!me.projectId) throw new Error('the workflow project of this organization is not ready');
  return { token, organizationId, projectId: me.projectId };
}

// On a fresh install the services come up one by one; keep trying for up to 10 minutes,
// until the AI service (chat-ai) and the marketplace answer too.
async function sessionWhenReady() {
  const deadline = Date.now() + 10 * 60_000;
  for (;;) {
    try {
      const s = await session();
      if (WAIT_API) {
        await call('GET', '/ai/v3/providers', { token: s.token, orgId: s.organizationId });
        await call('GET', '/v3/marketplaces/use-cases', { token: s.token, orgId: s.organizationId });
      }
      return s;
    } catch (e) {
      if (!WAIT_API || Date.now() > deadline) throw e;
      console.log(`waiting for the iMBrace API (${e.message.split('\n')[0].slice(0, 120)})`);
      await sleep(10_000);
    }
  }
}

async function findProvider(token, orgId) {
  const providers = await call('GET', '/ai/v3/providers', { token, orgId });
  return (providers.data ?? providers).find((p) => p.type === CLASSIFIER_PROVIDER_TYPE);
}

// The flow's AI step calls an iMBrace AI agent. It is created the way the dashboard creates
// one (a marketplace use case wrapping the assistant), so it shows on the AI Agent page.
// Returns null when there is no LLM provider yet and --wait-provider is set.
async function ensureClassifier(token, orgId) {
  const agent = JSON.parse(readFileSync(join(root, 'agents/request-classifier.json'), 'utf8'));
  const useCases = await call('GET', '/v3/marketplaces/use-cases', { token, orgId });
  const existing = (useCases.data ?? useCases).find((u) => u.title === agent.name && u.type === 'custom');
  if (existing) {
    await removeStandaloneCopies(token, orgId, agent.name, existing.assistant_id);
    return existing.assistant_id;
  }
  const provider = await findProvider(token, orgId);
  if (!provider) {
    if (WAIT_PROVIDER) return null;
    throw new Error(
      `no "${CLASSIFIER_PROVIDER_TYPE}" LLM provider in this organization. ` +
        'Add one in the dashboard (LLM Provider page) first, or set CLASSIFIER_PROVIDER_TYPE.',
    );
  }
  const assistantId = await createClassifier(token, orgId, agent, provider);
  await removeStandaloneCopies(token, orgId, agent.name, assistantId);
  return assistantId;
}

async function createClassifier(token, orgId, agent, provider) {
  // The dashboard points the agent's demo link at the chat widget; read its URL from the dashboard config.
  const dashboardConfig = await fetch(`${new URL(GATEWAY).origin}/config`).then((r) => r.json()).catch(() => ({}));
  const workflowName = `Standard | ${agent.name}`;
  const created = await call('POST', '/v3/marketplaces/use-cases/v2/custom', {
    token,
    orgId,
    body: {
      usecase: {
        title: agent.name,
        short_description: agent.description,
        demo_url: dashboardConfig.VITE_APP_CHAT_HOST ?? '',
        supported_channels: [],
        agent_type: 'agent',
      },
      assistant: {
        ...agent,
        model_id: CLASSIFIER_MODEL,
        provider_id: provider.id,
        workflow_name: workflowName,
        credential_name: workflowName,
        agent_type: 'agent',
        version: 2,
        category: [],
        metadata: {},
        file_ids: [],
        folder_ids: [],
        board_ids: [],
        knowledge_hubs: [],
        workflow_function_call: [],
      },
    },
  });
  console.log(`created AI agent "${agent.name}" (${CLASSIFIER_MODEL} on ${provider.name})`);
  return created.data.assistant_id;
}

// Earlier versions of this script created the assistant without a use case, so it never showed
// on the AI Agent page. Remove such leftovers with the same name.
async function removeStandaloneCopies(token, orgId, name, keepId) {
  const list = await call('GET', '/ai/v3/accounts/assistants?limit=1000', { token, orgId });
  for (const a of list.data ?? list) {
    const id = a.id ?? a.assistant_id;
    if (a.name === name && id !== keepId) {
      await call('DELETE', `/ai/v3/assistant_apps/${id}`, { token, orgId });
      console.log(`removed old standalone AI agent ${id}`);
    }
  }
}

// The AI step runs from a plain webhook, so it authenticates with an organization API key
// kept in a workflow connection. Created once; re-runs reuse the existing connection.
const CONNECTION_NAME = 'imbrace-api-key';
async function ensureApiKeyConnection(token, orgId, projectId) {
  const existing = await call('GET', `/activepieces/v1/app-connections?projectId=${projectId}&limit=100`, { token });
  if ((existing.data ?? []).some((c) => c.externalId === CONNECTION_NAME)) return;

  const created = await call('POST', '/platform/v1/third_party_token', {
    token,
    orgId,
    body: { name: 'workflow: customer-request example' },
  });
  const apiKey = created.apiKey?._id;
  if (!apiKey) throw new Error('could not create an organization API key');
  await call('POST', '/activepieces/v1/app-connections', {
    token,
    body: {
      externalId: CONNECTION_NAME,
      displayName: 'iMBrace API key',
      pieceName: '@activepieces/piece-ai-connector',
      projectId,
      type: 'SECRET_TEXT',
      value: { type: 'SECRET_TEXT', secret_text: apiKey },
    },
  });
  console.log(`created API key connection "${CONNECTION_NAME}"`);
}

function readFlow(file, { classifierId, organizationId }) {
  let text = readFileSync(join(root, file), 'utf8').replaceAll('__ORGANIZATION_ID__', organizationId);
  if (classifierId) text = text.replaceAll(CLASSIFIER_PLACEHOLDER, classifierId);
  return JSON.parse(text);
}

function flowState(flow, displayName) {
  return { id: flow.id, displayName, webhookUrl: `${WORKFLOW_PUBLIC}/api/v1/webhooks/${flow.id}` };
}

// In --seed mode a flow that already exists is left alone (it may have been edited in the UI),
// unless it still waits for the AI agent and the agent now exists.
async function keepExisting(token, flow, classifierId) {
  if (!SEED) return false;
  if (!classifierId) return true;
  const current = await call('GET', `/activepieces/v1/flows/${flow.id}`, { token });
  return !JSON.stringify(current.version ?? {}).includes(CLASSIFIER_PLACEHOLDER);
}

async function importFlows({ token, organizationId, projectId }, classifierId) {
  const existing = await call('GET', '/activepieces/v1/flows?limit=100', { token });
  const flows = {};
  for (const { key, file } of FLOWS) {
    const def = readFlow(file, { classifierId, organizationId });
    let flow = existing.data.find((f) => f.version?.displayName === def.displayName);
    if (flow && (await keepExisting(token, flow, classifierId))) {
      flows[key] = flowState(flow, def.displayName);
      console.log(`${def.displayName}: ${flows[key].webhookUrl} (already there, kept as is)`);
      continue;
    }
    if (flow && flow.status === 'ENABLED') {
      await call('POST', `/activepieces/v1/flows/${flow.id}`, {
        token,
        body: { type: 'CHANGE_STATUS', request: { status: 'DISABLED' } },
      });
    }
    if (!flow) {
      flow = await call('POST', '/activepieces/v1/flows', {
        token,
        body: { displayName: def.displayName, projectId },
      });
    }
    await call('POST', `/activepieces/v1/flows/${flow.id}`, {
      token,
      body: { type: 'IMPORT_FLOW', request: def },
    });
    await call('POST', `/activepieces/v1/flows/${flow.id}`, {
      token,
      body: { type: 'LOCK_AND_PUBLISH', request: {} },
    });
    await call('POST', `/activepieces/v1/flows/${flow.id}`, {
      token,
      body: { type: 'CHANGE_STATUS', request: { status: 'ENABLED' } },
    });
    flows[key] = flowState(flow, def.displayName);
    console.log(`${def.displayName}: ${flows[key].webhookUrl}`);
  }
  return flows;
}

async function lookUpFlows({ token }) {
  const existing = await call('GET', '/activepieces/v1/flows?limit=100', { token });
  const flows = {};
  for (const { key, file } of FLOWS) {
    const { displayName } = JSON.parse(readFileSync(join(root, file), 'utf8'));
    const flow = existing.data.find((f) => f.version?.displayName === displayName);
    if (!flow) throw new Error(`flow "${displayName}" not found; run "node scripts/setup.mjs" to import it`);
    flows[key] = flowState(flow, displayName);
    console.log(`${displayName}: ${flows[key].webhookUrl}`);
  }
  return flows;
}

function saveState(state) {
  writeFileSync(join(here, '.state.json'), JSON.stringify(state, null, 2) + '\n');
  console.log(`saved ${join('scripts', '.state.json')}`);
}

async function main() {
  if (SEED && /^(false|0|no|off)$/i.test(env('SEED_EXAMPLES', 'true'))) {
    console.log('SEED_EXAMPLES is off, nothing to do');
    return;
  }
  const s = await sessionWhenReady();

  if (STATE_ONLY) {
    const flows = await lookUpFlows(s);
    saveState({ organizationId: s.organizationId, projectId: s.projectId, flows });
    return;
  }

  let classifierId = await ensureClassifier(s.token, s.organizationId);
  await ensureApiKeyConnection(s.token, s.organizationId, s.projectId);
  let flows = await importFlows(s, classifierId);

  if (!classifierId) {
    console.log(
      `no "${CLASSIFIER_PROVIDER_TYPE}" LLM provider yet: the flows are imported, the AI step needs the agent. ` +
        'Add a provider in the dashboard (LLM Provider page); the agent is created within 30 seconds.',
    );
    while (!classifierId) {
      await sleep(30_000);
      const fresh = await sessionWhenReady(); // the access token may have expired meanwhile
      Object.assign(s, fresh);
      if (!(await findProvider(s.token, s.organizationId))) continue;
      classifierId = await ensureClassifier(s.token, s.organizationId);
    }
    flows = await importFlows(s, classifierId);
  }

  if (!SEED) saveState({ organizationId: s.organizationId, projectId: s.projectId, classifierId, flows });
  console.log('customer-request example is ready');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
