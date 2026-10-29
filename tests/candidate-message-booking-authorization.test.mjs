import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Executes the actual action body against a fake Supabase database. No real
// sessions, data or credentials are used.
const source = readFileSync(new URL("../src/lib/candidats/actions.ts", import.meta.url), "utf8");
const begin = source.indexOf("export async function markMessageBienRecu(");
const end = source.indexOf("export async function subscribeToPush(", begin);
assert.ok(begin >= 0 && end > begin, "candidate message action must exist");
const functionSource = source.slice(begin, end).replace(/^export /, "").replace("messageId: string", "messageId").trim();

function harness({ session = { id: "candidate-A" },
                   message = { id: "message-1", figurant_id: "candidate-A", sender: "staff", booking_id: "booking-1" },
                   booking = { id: "booking-1", figurant_id: "candidate-A" },
                   bookingError = null } = {}) {
  const writes = [];
  const refreshed = [];
  const db = {
    from(table) {
      const filters = [];
      let payload;
      return {
        update(value) { payload = value; return this; },
        eq(key, value) { filters.push([key, value]); return this; },
        select() { return this; },
        async single() {
          assert.equal(table, "figurant_messages");
          const match = message && filters.every(([k, v]) => message[k] === v);
          if (!match) return { data: null, error: { message: "Message introuvable" } };
          writes.push({ table, filters, payload });
          return { data: { booking_id: message.booking_id }, error: null };
        },
        async maybeSingle() {
          assert.equal(table, "bookings");
          if (bookingError) return { data: null, error: bookingError };
          const match = booking && filters.every(([k, v]) => booking[k] === v);
          if (!match) return { data: null, error: null };
          writes.push({ table, filters, payload });
          return { data: { id: booking.id }, error: null };
        },
      };
    },
  };
  const action = runInNewContext(`(${functionSource})`, {
    getCurrentFigurant: async () => session,
    createAdminClient: () => db,
    revalidatePath: (path) => refreshed.push(path),
    Date,
  });
  return { action, writes, refreshed };
}

test("rejects unauthenticated message acknowledgement before database access", async () => {
  const h = harness({ session: null });
  const result = await h.action("message-1");
  assert.equal(result.error, "Non connecté.");
  assert.equal(h.writes.length, 0);
});

test("acknowledges matching candidate's booking and revalidates paths", async () => {
  const h = harness();
  const result = await h.action("message-1");
  assert.equal(result.success, true);
  assert.equal(h.writes.length, 2);
  assert.deepEqual(Array.from(h.writes[1].filters, e => Array.from(e)), [["id", "booking-1"], ["figurant_id", "candidate-A"]]);
  assert.ok(h.refreshed.includes("/compte"));
});

test("never updates another candidate's booking even if referenced by own message", async () => {
  const h = harness({ booking: { id: "booking-1", figurant_id: "candidate-B" } });
  const result = await h.action("message-1");
  assert.match(result.error, /booking impossible/);
  assert.equal(h.writes.filter(w => w.table === "bookings").length, 0);
  assert.equal(h.refreshed.length, 0);
});

test("does not claim success on absent booking or database error", async () => {
  for (const options of [{ booking: null }, { bookingError: { message: "DB unavailable" } }]) {
    const h = harness(options);
    const result = await h.action("message-1");
    assert.match(result.error, /booking impossible/);
    assert.equal(h.refreshed.length, 0);
  }
});

test("candidate A cannot acknowledge candidate B's message by guessing its id", async () => {
  const h = harness({ message: { id: "message-1", figurant_id: "candidate-B", sender: "staff", booking_id: "booking-1" } });
  const result = await h.action("message-1");
  assert.ok(result.error);
  assert.equal(h.writes.length, 0);
  assert.equal(h.refreshed.length, 0);
});
