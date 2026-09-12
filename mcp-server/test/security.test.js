import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index.js';
import { readBoundedText } from '../src/bounded-body.js';
import { reserveDiscoveryUsage, usageContext } from '../src/usage-guard.js';
import { validatePublicUrl } from '../src/url-safety.js';
import { inspectHtml } from '../src/audit.js';

test('MCP rejects oversized bodies without a declared content length', async () => {
  const request = new Request('https://mcp.example/mcp', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list',params:{padding:'x'.repeat(70000)}}) });
  assert.equal((await handleRequest(request)).status, 413);
});

test('MCP refuses tool work when the rate-limit service fails', async () => {
  let fetched = false;
  const request = new Request('https://mcp.example/mcp', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'check_ai_presence',arguments:{website_url:'https://example.com'}}}) });
  const result = await handleRequest(request, {AUDIT_RATE_LIMITER:{limit:async()=>{throw new Error('private provider detail')}}}, async()=>{fetched=true;throw new Error('unexpected fetch');});
  assert.equal(result.status,503);
  assert.equal(fetched,false);
  assert.doesNotMatch(await result.text(),/private provider detail/);
});

test('body deadline terminates a stalled stream and cancels it', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({cancel(){cancelled=true;}}));
  await assert.rejects(readBoundedText(response,100,20),{name:'AbortError'});
  assert.equal(cancelled,true);
});

test('missing usage storage refuses paid work and missing hash secret shares a quota', async () => {
  assert.deepEqual(await reserveDiscoveryUsage({},'example.com'),{allowed:false,reason:'quota_unavailable'});
  assert.deepEqual(await usageContext(new Request('https://example.com',{headers:{'cf-connecting-ip':'203.0.113.1'}})),{visitor:'unknown'});
});

test('URL policy rejects unusual ports and access-token parameters', () => {
  for(const url of ['https://example.com:8080','https://example.com/?api_key=private','https://example.com/?access_token=private']) assert.throws(()=>validatePublicUrl(url));
  assert.equal(validatePublicUrl('https://example.com./').hostname,'example.com');
  assert.equal(validatePublicUrl('https://example.com/?page=2').search,'?page=2');
});

test('invalid numeric HTML entities cannot crash metadata parsing', () => {
  assert.doesNotThrow(()=>inspectHtml('<html><title>&#999999999999; &#xFFFFFF;</title></html>','https://example.com/'));
});
