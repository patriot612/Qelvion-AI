import type { Env } from '../env';
import { isAdminTelegramId, verifyTelegramWebAppInitData } from '../core/security/telegram';
import { D1ModelRegistry } from '../ai/registry';
import { D1ConfigRepository } from '../db/repositories/config';
import { D1AdminRepository } from '../db/repositories/admin';
import { D1UserRepository } from '../db/repositories/users';
import type { OperationStatus, OperationType } from '../core/operations/types';

const CONFIG_KEYS = new Set(['search.price','search.results_limit','search.editor_model','search.timeout_ms','search.enabled','search.language','search.safesearch','search.time_range','chat.model']);
const OPERATION_TYPES: readonly OperationType[] = ['chat','search','image','document','audio','voice','payment'];
const OPERATION_STATUSES: readonly OperationStatus[] = ['created','reserved','running','succeeded','failed','cancelled','delivery_pending','delivered'];

function parseOptionalEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  if (!value) return undefined;
  return allowed.includes(value as T) ? value as T : undefined;
}

export async function authorizeAdminRequest(request: Request, env: Env): Promise<number> {
  const initData = request.headers.get('X-Telegram-Init-Data') ?? '';
  const verified = await verifyTelegramWebAppInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (!isAdminTelegramId(env.ADMIN_TELEGRAM_IDS, verified.telegramUserId)) throw new Response('Forbidden', { status: 403 });
  return verified.telegramUserId;
}

async function jsonBody<T>(request: Request): Promise<T> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') throw new Response('Invalid JSON', { status: 400 });
  return body as T;
}

function positiveInt(value: unknown, name: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new Response(`${name} must be a non-negative integer`, { status: 400 });
  return Number(value);
}

export async function handleAdminApi(request: Request, env: Env): Promise<Response> {
  try {
    const adminTelegramId = await authorizeAdminRequest(request, env);
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/admin\/api\/?/, '');
    const repo = new D1AdminRepository(env.QELVION_DB);
    const models = new D1ModelRegistry(env.QELVION_DB);
    const config = new D1ConfigRepository(env.QELVION_DB);

    if (request.method === 'GET' && path === 'dashboard') {
      const [userCount, ops] = await Promise.all([
        repo.countUsers(),
        repo.listOperations({}, 10, 0),
      ]);
      const succeeded = ops.filter((op) => op.status === 'succeeded' || op.status === 'delivered').length;
      const failed = ops.filter((op) => op.status === 'failed').length;
      return Response.json({ users: userCount, recentOperations: ops.length, recentSucceeded: succeeded, recentFailed: failed, providers: {
        openai: Boolean(env.OPENAI_API_KEY), anthropic: Boolean(env.ANTHROPIC_API_KEY), google: Boolean(env.GOOGLE_AI_API_KEY), openrouter: Boolean(env.OPENROUTER_API_KEY),
      }, search: { configured: Boolean(env.SEARXNG_BASE_URL) } });
    }

    if (request.method === 'GET' && path === 'users') {
      const page = Math.max(0, Number(url.searchParams.get('page') ?? '0') || 0); const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '25') || 25));
      return Response.json({ users: await repo.listUsers(limit, page * limit, url.searchParams.get('q') ?? undefined), page, limit, total: await repo.countUsers() });
    }

    const userMatch = path.match(/^users\/([^/]+)$/);
    if (request.method === 'GET' && userMatch) {
      const user = await new D1UserRepository(env.QELVION_DB).findById(decodeURIComponent(userMatch[1]));
      if (!user) return new Response('Not found', { status: 404 });
      return Response.json({ user, operations: await repo.listOperations({ userId: user.id }, 50, 0), payments: await repo.listPayments(50, 0, user.id), ledger: await repo.listPointLedger(user.id), dialogs: await repo.listDialogs(user.id) });
    }

    const userActionMatch = path.match(/^users\/([^/]+)\/(points|balance|subscription|status)$/);
    if (request.method === 'POST' && userActionMatch) {
      const userId = decodeURIComponent(userActionMatch[1]); const action = userActionMatch[2];
      const userRepo = new D1UserRepository(env.QELVION_DB); const user = await userRepo.findById(userId);
      if (!user) return new Response('Not found', { status: 404 });
      const before = { balance: user.balance_points, status: user.status, subscription: user.subscription_status };
      const body = await jsonBody<Record<string, unknown>>(request);
      if (action === 'points') {
        const amount = positiveInt(body.amount, 'amount');
        if (body.direction !== 'add' && body.direction !== 'remove') throw new Response('direction must be add/remove', { status: 400 });
        if (amount > 0) {
          const kind = body.direction === 'remove' ? 'refund' : 'grant';
          const delta = body.direction === 'remove' ? -amount : amount;
          const now = new Date().toISOString();
          const ledgerId = crypto.randomUUID();
          const results = await env.QELVION_DB.batch([
            env.QELVION_DB.prepare(
              'UPDATE users SET balance_points = balance_points + ?, updated_at = ? WHERE id = ? AND balance_points + ? >= 0'
            ).bind(delta, now, userId, delta),
            env.QELVION_DB.prepare(
              "INSERT INTO point_ledger (entry_id, operation_id, user_id, kind, amount, created_at, metadata_json) SELECT ?, NULL, id, ?, ?, ?, ? FROM users WHERE id = ? AND changes() = 1"
            ).bind(ledgerId, userId, kind, amount, now, JSON.stringify({ adminTelegramId }), userId),
          ]);
          if ((results[0]?.meta?.changes ?? 0) !== 1 || (results[1]?.meta?.changes ?? 0) !== 1) {
            throw new Response('Balance changed concurrently; retry the operation', { status: 409 });
          }
        }
      } else if (action === 'balance') {
        const target = positiveInt(body.value, 'value');
        const beforeBalance = user.balance_points;
        const delta = target - beforeBalance;
        if (delta !== 0) {
          const now = new Date().toISOString();
          const ledgerId = crypto.randomUUID();
          const kind = delta > 0 ? 'grant' : 'refund';
          const results = await env.QELVION_DB.batch([
            env.QELVION_DB.prepare('UPDATE users SET balance_points = ?, updated_at = ? WHERE id = ? AND balance_points = ?')
              .bind(target, now, userId, beforeBalance),
            env.QELVION_DB.prepare(
              "INSERT INTO point_ledger (entry_id, operation_id, user_id, kind, amount, created_at, metadata_json) SELECT ?, NULL, id, ?, ?, ?, ? FROM users WHERE id = ? AND changes() = 1"
            ).bind(ledgerId, userId, kind, Math.abs(delta), now, JSON.stringify({ adminTelegramId, reason: 'set_balance' }), userId),
          ]);
          if ((results[0]?.meta?.changes ?? 0) !== 1 || (results[1]?.meta?.changes ?? 0) !== 1) {
            throw new Response('Balance changed concurrently; retry the operation', { status: 409 });
          }
        }
      } else if (action === 'subscription') {
        if (typeof body.value !== 'string') throw new Response('subscription value required', { status: 400 });
        await env.QELVION_DB.prepare('UPDATE users SET subscription_status = ?, updated_at = ? WHERE id = ?').bind(body.value, new Date().toISOString(), userId).run();
      } else {
        if (body.value !== 'active' && body.value !== 'blocked') throw new Response('status must be active/blocked', { status: 400 });
        await env.QELVION_DB.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').bind(body.value, new Date().toISOString(), userId).run();
      }
      const afterUser = await userRepo.findById(userId);
      await repo.addAudit({ adminTelegramId, targetUserId: userId, action: `user.${action}`, beforeJson: JSON.stringify(before), afterJson: JSON.stringify(afterUser ? { balance: afterUser.balance_points, status: afterUser.status, subscription: afterUser.subscription_status } : {}) });
      return Response.json({ ok: true, user: afterUser });
    }

    if (request.method === 'GET' && path === 'models') return Response.json({ models: await models.list() });
    if (request.method === 'POST' && path === 'models') {
      const body = await jsonBody<{ key: string; name: string; provider: string; providerModelId: string; capabilities: string[]; active?: boolean; accessLevel?: string; pointCost?: number; config?: Record<string, unknown> }>(request);
      if (!body.key || !body.provider || !body.providerModelId || !Array.isArray(body.capabilities)) throw new Response('Invalid model', { status: 400 });
      await env.QELVION_DB.prepare('INSERT INTO models (key,name,provider,provider_model_id,capabilities_json,active,access_level,point_cost,config_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET name=excluded.name,provider=excluded.provider,provider_model_id=excluded.provider_model_id,capabilities_json=excluded.capabilities_json,active=excluded.active,access_level=excluded.access_level,point_cost=excluded.point_cost,config_json=excluded.config_json,updated_at=excluded.updated_at')
        .bind(body.key, body.name, body.provider, body.providerModelId, JSON.stringify(body.capabilities), body.active === false ? 0 : 1, body.accessLevel ?? 'daily', positiveInt(body.pointCost ?? 0, 'pointCost'), JSON.stringify(body.config ?? {}), new Date().toISOString(), new Date().toISOString()).run();
      await repo.addAudit({ adminTelegramId, targetUserId: null, action: 'model.upsert', beforeJson: '{}', afterJson: JSON.stringify({ key: body.key, provider: body.provider, providerModelId: body.providerModelId }) });
      return Response.json({ ok: true, model: await models.getActiveByKey(body.key) });
    }

    if (request.method === 'PATCH' && path.startsWith('models/')) {
      const key = decodeURIComponent(path.slice('models/'.length)); const body = await jsonBody<Record<string, unknown>>(request);
      const current = await env.QELVION_DB.prepare('SELECT * FROM models WHERE key = ?').bind(key).first<Record<string, unknown>>(); if (!current) return new Response('Not found', { status: 404 });
      const before = await models.getActiveByKey(key);
      await env.QELVION_DB.prepare('UPDATE models SET name = COALESCE(?,name), provider = COALESCE(?,provider), provider_model_id = COALESCE(?,provider_model_id), capabilities_json = COALESCE(?,capabilities_json), active = COALESCE(?,active), access_level = COALESCE(?,access_level), point_cost = COALESCE(?,point_cost), config_json = COALESCE(?,config_json), updated_at = ? WHERE key = ?')
        .bind(typeof body.name === 'string' ? body.name : null, typeof body.provider === 'string' ? body.provider : null, typeof body.providerModelId === 'string' ? body.providerModelId : null, Array.isArray(body.capabilities) ? JSON.stringify(body.capabilities) : null, typeof body.active === 'boolean' ? (body.active ? 1 : 0) : null, typeof body.accessLevel === 'string' ? body.accessLevel : null, body.pointCost === undefined ? null : positiveInt(body.pointCost, 'pointCost'), body.config ? JSON.stringify(body.config) : null, new Date().toISOString(), key).run();
      await repo.addAudit({ adminTelegramId, targetUserId: null, action: 'model.update', beforeJson: JSON.stringify(current ?? before), afterJson: JSON.stringify(body) });
      return Response.json({ ok: true, model: await models.getActiveByKey(key) });
    }

    if (request.method === 'GET' && path === 'roles') return Response.json({ roles: await repo.listRoles() });
    if (request.method === 'POST' && path === 'roles') {
      const body = await jsonBody<{ key: string; name: string; prompt: string; pointCost?: number; active?: boolean; config?: Record<string, unknown> }>(request);
      if (!body.key || !body.name || !body.prompt) throw new Response('Invalid role', { status: 400 });
      await repo.upsertRole({ ...body, pointCost: positiveInt(body.pointCost ?? 0, 'pointCost'), active: body.active !== false });
      await repo.addAudit({ adminTelegramId, targetUserId: null, action: 'role.upsert', beforeJson: '{}', afterJson: JSON.stringify(body) });
      return Response.json({ ok: true });
    }

    if (request.method === 'GET' && path === 'tariffs') return Response.json({ tariffs: await repo.listTariffs() });
    if (request.method === 'POST' && path === 'tariffs') {
      const body = await jsonBody<{ key: string; name: string; status?: string; dailyPoints?: number; activeDialogLimit?: number; archivedDialogLimit?: number; archiveTtlHours?: number; messageLimitPerDialog?: number; config?: Record<string, unknown> }>(request);
      await repo.upsertTariff({ key: body.key, name: body.name, status: body.status ?? 'active', dailyPoints: positiveInt(body.dailyPoints ?? 50, 'dailyPoints'), activeDialogLimit: positiveInt(body.activeDialogLimit ?? 5, 'activeDialogLimit'), archivedDialogLimit: positiveInt(body.archivedDialogLimit ?? 15, 'archivedDialogLimit'), archiveTtlHours: Math.max(1, positiveInt(body.archiveTtlHours ?? 24, 'archiveTtlHours')), messageLimitPerDialog: Math.max(1, positiveInt(body.messageLimitPerDialog ?? 50, 'messageLimitPerDialog')), ...(body.config === undefined ? {} : { config: body.config }) });
      await repo.addAudit({ adminTelegramId, targetUserId: null, action: 'tariff.upsert', beforeJson: '{}', afterJson: JSON.stringify(body) });
      return Response.json({ ok: true });
    }

    if (request.method === 'GET' && path === 'payments') return Response.json({ payments: await repo.listPayments(Number(url.searchParams.get('limit') ?? 50), Number(url.searchParams.get('offset') ?? 0)) });
    if (request.method === 'GET' && path === 'operations') {
      const type = parseOptionalEnum(url.searchParams.get('type'), OPERATION_TYPES);
      const status = parseOptionalEnum(url.searchParams.get('status'), OPERATION_STATUSES);
      const filters = {
        ...(url.searchParams.get('user') ? { userId: url.searchParams.get('user')! } : {}),
        ...(url.searchParams.get('operationId') ? { operationId: url.searchParams.get('operationId')! } : {}),
        ...(type === undefined ? {} : { type }),
        ...(status === undefined ? {} : { status }),
        ...(url.searchParams.get('provider') ? { provider: url.searchParams.get('provider')! } : {}),
        ...(url.searchParams.get('model') ? { model: url.searchParams.get('model')! } : {}),
        ...(url.searchParams.get('from') ? { from: url.searchParams.get('from')! } : {}),
        ...(url.searchParams.get('to') ? { to: url.searchParams.get('to')! } : {}),
      };
      return Response.json({ operations: await repo.listOperations(filters, 100, 0) });
    }
    if (request.method === 'GET' && path === 'audit') return Response.json({ entries: await repo.listAudit() });
    if (request.method === 'GET' && path === 'config') return Response.json({ keys: Array.from(CONFIG_KEYS), values: Object.fromEntries(await Promise.all(Array.from(CONFIG_KEYS).map(async (key) => [key, await config.getJson(key, null)]))) });
    if (request.method === 'PUT' && path === 'config') {
      const body = await jsonBody<{ key: string; value: unknown }>(request); if (!CONFIG_KEYS.has(body.key)) throw new Response('forbidden key', { status: 400 });
      await config.setJson(body.key, body.value); await repo.addAudit({ adminTelegramId, targetUserId: null, action: 'config.update', beforeJson: '{}', afterJson: JSON.stringify({ key: body.key, value: body.value }) }); return Response.json({ ok: true });
    }
    if (request.method === 'GET' && path === 'system') {
      const searchUrl = env.SEARXNG_BASE_URL;
      let searxng: 'configured' | 'healthy' | 'unavailable' = searchUrl ? 'configured' : 'unavailable';
      if (url.searchParams.get('health') === '1' && searchUrl) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3000);
          const headers: Record<string, string> = { Accept: 'application/json' };
          if (env.SEARXNG_USERNAME && env.SEARXNG_PASSWORD) headers.Authorization = `Basic ${btoa(`${env.SEARXNG_USERNAME}:${env.SEARXNG_PASSWORD}`)}`;
          const response = await fetch(new URL('/search?q=health&format=json', searchUrl), { headers, signal: controller.signal });
          clearTimeout(timer);
          searxng = response.ok ? 'healthy' : 'unavailable';
        } catch { searxng = 'unavailable'; }
      }
      return Response.json({ queue: 'configured', searxng, providers: { openai: Boolean(env.OPENAI_API_KEY), anthropic: Boolean(env.ANTHROPIC_API_KEY), google: Boolean(env.GOOGLE_AI_API_KEY), openrouter: Boolean(env.OPENROUTER_API_KEY) } });
    }
    return new Response('Not found', { status: 404 });
  } catch (error) {
    if (error instanceof Response) return error;
    return new Response('Forbidden', { status: 403 });
  }
}

export async function adminHtml(): Promise<Response> {
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Qelvion Admin</title>
<style>
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:light dark}
body{margin:0;padding:12px;background:#f4f5f7;color:#111}
header{position:sticky;top:0;background:#f4f5f7;padding:6px 0 12px;z-index:2}
h1{font-size:22px;margin:4px 0 10px}
h2{font-size:18px;margin:0 0 10px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
button{font:inherit;padding:10px 12px;border-radius:11px;border:1px solid #d7d7da;background:#fff;width:100%;text-align:left;cursor:pointer}
button.primary{background:#111;color:#fff}
button.danger{border-color:#d55}
button.small{width:auto;padding:7px 9px}
section{background:#fff;border:1px solid #e2e2e5;border-radius:14px;padding:13px;margin:10px 0}
.row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.row3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
input,select,textarea{font:inherit;padding:9px;width:100%;box-sizing:border-box;border:1px solid #d7d7da;border-radius:10px;margin:5px 0}
label{display:block;font-size:13px}
.muted{color:#666;font-size:12px}
.card{padding:10px;border:1px solid #e5e5e7;border-radius:12px;margin:8px 0}
.toolbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.toolbar>*{flex:1}
pre{white-space:pre-wrap;word-break:break-word;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border-bottom:1px solid #eee;padding:7px;text-align:left;vertical-align:top}
.badge{display:inline-block;padding:3px 7px;border-radius:999px;background:#eee;font-size:11px}
details{margin-top:8px}
</style></head><body>
<header><h1>Qelvion Admin</h1><div class="grid">
<button data-view="dashboard">Dashboard</button><button data-view="users">Users</button><button data-view="models">Models</button><button data-view="roles">AI Roles</button><button data-view="tariffs">Tariffs</button><button data-view="payments">Payments</button><button data-view="operations">Operations</button><button data-view="config">Configuration</button><button data-view="system">Queue / System</button><button data-view="audit">Audit</button>
</div></header><main id="app"><section>Loading…</section></main>
<script src="https://telegram.org/js/telegram-web-app.js"></script><script>
Telegram.WebApp.ready();
const app=document.getElementById('app');
const init=()=>Telegram.WebApp.initData||'';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const api=async(path,opts={})=>{opts.headers={...(opts.headers||{}),'X-Telegram-Init-Data':init(),'Content-Type':'application/json'};const r=await fetch('/admin/api/'+path,opts);if(!r.ok)throw new Error(await r.text());return r.json()};
const confirmAction=(msg)=>window.confirm(msg);
const field=(label,id,value='',type='text')=>'<label>'+esc(label)+'<input id="'+id+'" type="'+type+'" value="'+esc(value??'')+'"></label>';
const selectField=(label,id,value,items)=>'<label>'+esc(label)+'<select id="'+id+'">'+items.map(v=>'<option value="'+esc(v)+'"'+(v===value?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>';
const json=value=>typeof value==='string'?value:JSON.stringify(value??null);
async function load(view){app.innerHTML='<section>Loading…</section>';try{
if(view==='dashboard'){
 const d=await api('dashboard');
 app.innerHTML='<section><h2>Dashboard</h2><div class="row3"><div class="card"><b>Users</b><div>'+esc(d.users)+'</div></div><div class="card"><b>Recent ops</b><div>'+esc(d.recentOperations)+'</div></div><div class="card"><b>Search</b><div>'+esc(d.search?.configured?'configured':'unavailable')+'</div></div></div><pre>'+esc(JSON.stringify(d,null,2))+'</pre></section>';
}
else if(view==='users'){
 const q=new URLSearchParams(location.search); const page=Math.max(0,Number(q.get('upage')||'0')); const d=await api('users?limit=25&page='+page+'&q='+encodeURIComponent(q.get('uq')||'')); 
 app.innerHTML='<section><h2>Users</h2><div class="toolbar"><input id="uq" placeholder="Telegram ID / internal ID" value="'+esc(q.get('uq')||'')+'"><button id="usearch" class="primary small">Search</button></div></section><div id="usercards"></div>';
 const cards=document.getElementById('usercards');
 cards.innerHTML=(d.users||[]).map(u=>'<section class="card"><b>'+esc(u.id)+'</b><div class="muted">Telegram: '+esc(u.telegram_user_id)+' · created: '+esc(u.created_at)+'</div><div>Balance: <b>'+esc(u.balance_points)+'</b> · Daily: '+esc(u.daily_points_remaining)+' · '+esc(u.status)+' · '+esc(u.subscription_status)+'</div><details><summary>Actions</summary><div class="row">'+field('Points','amt_'+esc(u.id),10,'number')+'<select id="sub_'+esc(u.id)+'"><option value="free">free</option><option value="'+esc(u.subscription_status)+'" selected>'+esc(u.subscription_status)+'</option></select></div><div class="row"><button data-a="add" data-id="'+esc(u.id)+'">Add points</button><button data-a="remove" data-id="'+esc(u.id)+'" class="danger">Remove points</button></div><div class="row"><button data-a="block" data-id="'+esc(u.id)+'" class="danger">Block</button><button data-a="unblock" data-id="'+esc(u.id)+'">Unblock</button></div><div class="row"><button data-a="subscription" data-id="'+esc(u.id)+'">Set subscription</button><button data-a="balance" data-id="'+esc(u.id)+'">Set balance</button></div></details></section>').join('');
 cards.querySelectorAll('button[data-a]').forEach(btn=>btn.onclick=async()=>{const id=btn.dataset.id;const action=btn.dataset.a;if(!id||!action)return;if(!confirmAction('Подтвердить действие?'))return;try{
   if(action==='add'||action==='remove'){const n=Number(document.getElementById('amt_'+id).value);await api('users/'+encodeURIComponent(id)+'/points',{method:'POST',body:JSON.stringify({amount:n,direction:action==='add'?'add':'remove'})});}
   else if(action==='block'||action==='unblock') await api('users/'+encodeURIComponent(id)+'/status',{method:'POST',body:JSON.stringify({value:action==='block'?'blocked':'active'})});
   else if(action==='subscription') await api('users/'+encodeURIComponent(id)+'/subscription',{method:'POST',body:JSON.stringify({value:document.getElementById('sub_'+id).value})});
   else if(action==='balance'){const n=Number(prompt('Новое количество points'));if(Number.isInteger(n)&&n>=0)await api('users/'+encodeURIComponent(id)+'/balance',{method:'POST',body:JSON.stringify({value:n})});}
   await load('users');
 }catch(e){alert(e.message)}}); 
 document.getElementById('usearch').onclick=()=>{const value=document.getElementById('uq').value;location.search='?uq='+encodeURIComponent(value);};
}
else if(view==='models'){
 const d=await api('models');
 app.innerHTML='<section><h2>Models</h2><form id="mf">'+field('Key','mk')+field('Name','mn')+field('Provider','mp')+field('Provider model id','mmi')+field('Capabilities CSV','mc','chat')+field('Point cost','mcost',0,'number')+field('Access level','mal','daily')+'<label><input id="mactive" type="checkbox" checked> active</label><button class="primary">Save model</button></form></section><section>'+((d.models||[]).map(m=>'<div class="card"><b>'+esc(m.key)+'</b><div>'+esc(m.provider)+':'+esc(m.providerModelId)+'</div><div>cost '+esc(m.pointCost)+' · '+esc(m.accessLevel)+' · capabilities '+esc((m.capabilities||[]).join(', '))+'</div><button data-edit="'+esc(m.key)+'">Edit</button></div>').join(''))+'</section>';
 document.getElementById('mf').onsubmit=async e=>{e.preventDefault();await api('models',{method:'POST',body:JSON.stringify({key:mk.value,name:mn.value,provider:mp.value,providerModelId:mmi.value,capabilities:mc.value.split(',').map(s=>s.trim()).filter(Boolean),pointCost:Number(mcost.value),accessLevel:mal.value,active:mactive.checked})});await load('models')};
 document.querySelectorAll('[data-edit]').forEach(btn=>btn.onclick=async()=>{const m=(d.models||[]).find(x=>x.key===btn.dataset.edit);if(!m)return;mk.value=m.key;mn.value=m.name||m.key;mp.value=m.provider;mmi.value=m.providerModelId;mc.value=(m.capabilities||[]).join(',');mcost.value=m.pointCost;mal.value=m.accessLevel||'daily';mactive.checked=true;window.scrollTo({top:0,behavior:'smooth'})});
}
else if(view==='roles'){
 const d=await api('roles');
 app.innerHTML='<section><h2>AI Roles</h2><form id="rf">'+field('Key','rk')+field('Name','rn')+'<textarea id="rp" placeholder="Prompt"></textarea>'+field('Point cost','rpc',0,'number')+'<label><input id="ractive" type="checkbox" checked> active</label><button class="primary">Save role</button></form></section><section>'+((d.roles||[]).map(r=>'<div class="card"><b>'+esc(r.key)+'</b><div>'+esc(r.name)+' · cost '+esc(r.pointCost)+' · '+(r.active?'active':'disabled')+'</div><button data-role-edit="'+esc(r.key)+'">Edit</button></div>').join(''))+'</section>';
 document.getElementById('rf').onsubmit=async e=>{e.preventDefault();await api('roles',{method:'POST',body:JSON.stringify({key:rk.value,name:rn.value,prompt:rp.value,pointCost:Number(rpc.value),active:ractive.checked})});await load('roles')};
 document.querySelectorAll('[data-role-edit]').forEach(btn=>btn.onclick=()=>{const r=(d.roles||[]).find(x=>x.key===btn.dataset.roleEdit);if(!r)return;rk.value=r.key;rn.value=r.name;rp.value=r.prompt;rpc.value=r.pointCost;ractive.checked=r.active;window.scrollTo({top:0,behavior:'smooth'})});
}
else if(view==='tariffs'){
 const d=await api('tariffs');
 app.innerHTML='<section><h2>Tariffs</h2><form id="tf">'+field('Key','tk')+field('Name','tn')+field('Daily points','td',50,'number')+field('Active dialogs','ta',5,'number')+field('Archived dialogs','tr',15,'number')+field('Archive TTL hours','tt',24,'number')+field('Messages/dialog','tm',50,'number')+field('Status','ts','active')+'<button class="primary">Save tariff</button></form></section><section>'+((d.tariffs||[]).map(t=>'<div class="card"><b>'+esc(t.key)+'</b><div>'+esc(t.name)+' · '+esc(t.status)+' · daily '+esc(t.daily_points)+'</div><button data-tariff-edit="'+esc(t.key)+'">Edit</button></div>').join(''))+'</section>';
 document.getElementById('tf').onsubmit=async e=>{e.preventDefault();await api('tariffs',{method:'POST',body:JSON.stringify({key:tk.value,name:tn.value,dailyPoints:Number(td.value),activeDialogLimit:Number(ta.value),archivedDialogLimit:Number(tr.value),archiveTtlHours:Number(tt.value),messageLimitPerDialog:Number(tm.value),status:ts.value})});await load('tariffs')};
 document.querySelectorAll('[data-tariff-edit]').forEach(btn=>btn.onclick=()=>{const t=(d.tariffs||[]).find(x=>x.key===btn.dataset.tariffEdit);if(!t)return;tk.value=t.key;tn.value=t.name;td.value=t.daily_points;ta.value=t.active_dialog_limit;tr.value=t.archived_dialog_limit;tt.value=t.archive_ttl_hours;tm.value=t.message_limit_per_dialog;ts.value=t.status;window.scrollTo({top:0,behavior:'smooth'})});
}
else if(view==='payments'){
 const offset=Math.max(0,Number(new URLSearchParams(location.search).get('poffset')||'0')); const d=await api('payments?limit=50&offset='+offset);
 app.innerHTML='<section><h2>Payments</h2><pre>'+esc(JSON.stringify(d.payments||[],null,2))+'</pre></section>';
}
else if(view==='operations'){
 app.innerHTML='<section><h2>Operations</h2><div class="row">'+field('User','ou')+field('Operation ID','oo')+field('Provider','op')+field('Model','om')+'</div><div class="row">'+field('From','of')+field('To','ot')+field('Type','oty')+field('Status','ost')+'</div><button id="osearch" class="primary">Apply filters</button></section><div id="ops"></div>';
 const params=new URLSearchParams(location.search); const q='operations?'+['user','operationId','provider','model','from','to','type','status'].map(k=>{const id='o'+({user:'u',operationId:'o',provider:'p',model:'m',from:'f',to:'t',type:'ty',status:'st'}[k]);const v=params.get(k)||'';if(v)document.getElementById(id).value=v;return v?encodeURIComponent(k)+'='+encodeURIComponent(v):''}).filter(Boolean).join('&');
 const d=await api(q);document.getElementById('ops').innerHTML='<section><pre>'+esc(JSON.stringify(d.operations||[],null,2))+'</pre></section>';
 document.getElementById('osearch').onclick=()=>{const p=new URLSearchParams();[['user','ou'],['operationId','oo'],['provider','op'],['model','om'],['from','of'],['to','ot'],['type','oty'],['status','ost']].forEach(([k,id])=>{const v=document.getElementById(id).value;if(v)p.set(k,v)});location.search=p.toString()};
}
else if(view==='config'){
 const d=await api('config'); const keys=d.keys||[]; 
 app.innerHTML='<section><h2>Configuration</h2>'+keys.map(k=>'<div class="card"><b>'+esc(k)+'</b>'+field('Value','c_'+k.replace(/[^a-z0-9]/gi,'_'),json(d.values[k]))+'<button data-config="'+esc(k)+'">Save</button></div>').join('')+'</section>';
 document.querySelectorAll('[data-config]').forEach(btn=>btn.onclick=async()=>{const k=btn.dataset.config;const input=document.getElementById('c_'+k.replace(/[^a-z0-9]/gi,'_'));let value=input.value;try{value=JSON.parse(value)}catch{}await api('config',{method:'PUT',body:JSON.stringify({key:k,value})});btn.textContent='Saved';setTimeout(()=>btn.textContent='Save',1000)});
}
else if(view==='system'){
 const d=await api('system?health=1'); app.innerHTML='<section><h2>Queue / System</h2><p>SearXNG: <span class="badge">'+esc(d.searxng)+'</span></p><pre>'+esc(JSON.stringify(d,null,2))+'</pre></section>';
}
else if(view==='audit'){
 const d=await api('audit'); app.innerHTML='<section><h2>Audit trail</h2><pre>'+esc(JSON.stringify(d.entries||[],null,2))+'</pre></section>';
}
}catch(e){app.innerHTML='<section><b>Ошибка</b><p>'+esc(e.message)+'</p></section>';}}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>load(b.dataset.view));
load('dashboard');
</script></body></html>`;
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}
