import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const workerSource = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

function createWorker(fetchImpl = async () => ({ body: "private page" })) {
  const listeners = new Map();
  const entries = new Map([["booking-extras-shell-v1", new Map([["/bookings", { body: "old private booking" }]])], ["other-app-cache", new Map()]]);
  const puts = [];
  const caches = {
    async open(name) {
      if (!entries.has(name)) entries.set(name, new Map());
      const store = entries.get(name);
      return {
        async addAll(urls) { for (const url of urls) store.set(url, { body: `public ${url}` }); },
        async match(url) { return store.get(url); },
        async put(request, response) { puts.push({ request, response }); store.set(request.url || request, response); },
      };
    },
    async keys() { return [...entries.keys()]; },
    async delete(name) { return entries.delete(name); },
  };
  const self = {
    addEventListener(name, cb) { listeners.set(name, cb); },
    skipWaiting() {},
    clients: { claim() {} },
  };
  runInNewContext(workerSource, { self, caches, fetch: fetchImpl, Response: { error: () => ({ body: "network error" }) } });
  async function dispatch(name, request) {
    let pending;
    const event = {
      request,
      waitUntil(p) { pending = p; },
      respondWith(p) { pending = p; },
    };
    listeners.get(name)(event);
    return pending && (await pending);
  }
  return { dispatch, entries, puts };
}

test("install caches only the public offline page", async () => {
  const sw = createWorker();
  await sw.dispatch("install");
  assert.deepEqual([...sw.entries.get("booking-extras-offline-v3").keys()], ["/offline.html"]);
});

test("activation purges legacy Booking Extras caches but not other applications", async () => {
  const sw = createWorker();
  await sw.dispatch("install");
  await sw.dispatch("activate");
  assert.equal(sw.entries.has("booking-extras-shell-v1"), false);
  assert.equal(sw.entries.has("other-app-cache"), true);
});

test("private navigations are never cached, even when the network succeeds", async () => {
  const sw = createWorker();
  await sw.dispatch("install");
  const response = await sw.dispatch("fetch", { mode: "navigate", url: "https://booking-extras.vercel.app/figurants/secret" });
  assert.equal(response.body, "private page");
  assert.equal(sw.puts.length, 0);
  assert.deepEqual([...sw.entries.get("booking-extras-offline-v3").keys()], ["/offline.html"]);
});

test("offline navigation never returns a previously cached private page", async () => {
  const sw = createWorker(async () => { throw new Error("offline"); });
  await sw.dispatch("install");
  await sw.dispatch("activate");
  const result = await sw.dispatch("fetch", { mode: "navigate", url: "https://booking-extras.vercel.app/bookings" });
  assert.equal(result.body, "public /offline.html");
  assert.equal(sw.entries.has("booking-extras-shell-v1"), false);
});

test("non-navigation requests are left alone", async () => {
  const sw = createWorker();
  assert.equal(await sw.dispatch("fetch", { mode: "cors", url: "https://booking-extras.vercel.app/api" }), undefined);
  assert.equal(sw.puts.length, 0);
});
