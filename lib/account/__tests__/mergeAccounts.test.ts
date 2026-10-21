import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockTransaction } from "@/lib/account/__tests__/mockTransaction";

const outside = () => {
  throw new Error("statement outside the transaction");
};
const state = vi.hoisted(() => ({ tx: null as unknown, rolledBack: false }));
const transaction = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/db", () => ({
  db: {
    transaction,
    select: outside,
    update: outside,
    delete: outside,
    execute: outside,
    insert: outside,
    query: { users: { findFirst: outside } },
  },
}));
const { mergeAccounts } = await import("@/lib/account/mergeAccounts");

const CURRENT = "11111111-1111-4111-8111-111111111111";
const LEGACY = "22222222-2222-4222-8222-222222222222";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const date = "2026-09-06T12:00:00Z";
const currentUser = {
  id: CURRENT,
  privyUserId: "did:privy:current",
  email: "current@example.test",
  wallet: null,
  username: "Aux Bandit",
  usernameNeedsConfirmation: false,
  usernamePromptedAt: date,
  acceptedUgcCount: 3,
};
const legacyUser = {
  id: LEGACY,
  privyUserId: null,
  email: null,
  wallet: "0xlegacy",
  username: "Original Listener",
  usernameNeedsConfirmation: false,
  usernamePromptedAt: null,
  acceptedUgcCount: 10,
};

function setup(results: unknown[][]) {
  const { tx, log } = mockTransaction(results);
  state.tx = tx;
  state.rolledBack = false;
  transaction.mockImplementation(async (fn: (t: unknown) => unknown) => {
    try {
      return await fn(tx);
    } catch (error) {
      state.rolledBack = true;
      throw error;
    }
  });
  return { tx, log };
}

beforeEach(() => {
  transaction.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("mergeAccounts", () => {
  it("runs every step in one transaction, in Web's order", async () => {
    const { log } = setup([
      [{ id: CURRENT }, { id: LEGACY }],
      [currentUser],
      [legacyUser],
      [{ artistId: A, createdAt: date }],
      [{ artistId: B, createdAt: date, removedAt: null }],
    ]);
    expect(await mergeAccounts(CURRENT, LEGACY)).toEqual({ success: true });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(log.map(({ kind }) => kind)).toEqual([
      "execute",
      "select for update",
      "findFirst",
      "findFirst",
      "update",
      "update",
      "execute",
      "execute",
      "execute",
      "execute",
      "select",
      "select",
      "insert on conflict do nothing",
      "update",
      "execute",
      "delete",
    ]);
    expect(log[0].text).toBe("select pg_advisory_xact_lock(1387)");
    expect(log[1].params).toEqual([CURRENT, LEGACY]);
    expect(log[2].params).toEqual([CURRENT]);
    expect(log[3].params).toEqual([LEGACY]);
    expect(log[4]).toMatchObject({
      values: { privyUserId: null, username: null },
      params: [CURRENT],
    });
    expect(log[5]).toMatchObject({
      values: {
        username: "Aux Bandit",
        usernameNeedsConfirmation: false,
        usernamePromptedAt: date,
        privyUserId: "did:privy:current",
        email: "current@example.test",
        acceptedUgcCount: 13,
      },
      params: [LEGACY],
    });
    expect(log[6]).toMatchObject({
      text: "UPDATE artists SET added_by = $1 WHERE added_by = $2",
      params: [LEGACY, CURRENT],
    });
    expect(log[7]).toMatchObject({
      text: "UPDATE ugcresearch SET user_id = $1 WHERE user_id = $2",
      params: [LEGACY, CURRENT],
    });
    expect(log[8]).toMatchObject({
      text: "UPDATE artist_self_edits SET user_id = $1 WHERE user_id = $2",
      params: [LEGACY, CURRENT],
    });
    expect(log[9]).toMatchObject({
      text: "SELECT public.transfer_account_activity( $1::uuid, $2::uuid, $3 )",
      params: [CURRENT, LEGACY, "did:privy:current"],
    });
    expect(log[12].rows).toEqual([
      { userId: LEGACY, artistId: B, createdAt: date, removedAt: null, position: 1 },
    ]);
    expect(log[13].values).toMatchObject({ position: { params: [A, 0, B, 1] } });
    expect(log[14].text).toContain("update artist_bio_corrections set");
    expect(log[14].params).toEqual([CURRENT, LEGACY, CURRENT, LEGACY, CURRENT, CURRENT]);
    expect(log[15].params).toEqual([CURRENT]);
    expect(state.rolledBack).toBe(false);
  });

  it("keeps the legacy name when the current generated name was not confirmed", async () => {
    const { log } = setup([
      [{ id: CURRENT }, { id: LEGACY }],
      [{ ...currentUser, usernameNeedsConfirmation: true }],
      [legacyUser],
      [],
      [],
    ]);
    expect(await mergeAccounts(CURRENT, LEGACY)).toEqual({ success: true });
    expect(log[4].values).toEqual({ privyUserId: null });
    expect(log[5].values).toMatchObject({ usernamePromptedAt: date });
    expect(log[5].values).not.toHaveProperty("username");
    expect(log.map(({ kind }) => kind)).not.toContain("insert");
  });

  it("refuses the same account without opening a transaction", async () => {
    setup([]);
    expect(await mergeAccounts(CURRENT, CURRENT)).toEqual({
      success: false,
      error: "Cannot merge the same account",
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["User not found", [currentUser], []],
    ["Current user has no Privy ID", [{ ...currentUser, privyUserId: null }], [legacyUser]],
    [
      "Legacy account is already linked to another user",
      [currentUser],
      [{ ...legacyUser, privyUserId: "did:privy:other" }],
    ],
  ])("writes nothing when %s", async (error, current, legacy) => {
    const { log } = setup([[{ id: CURRENT }, { id: LEGACY }], current, legacy]);
    expect(await mergeAccounts(CURRENT, LEGACY)).toEqual({ success: false, error });
    expect(log.map(({ kind }) => kind)).toEqual([
      "execute",
      "select for update",
      "findFirst",
      "findFirst",
    ]);
  });

  it("rolls the whole merge back when a later step fails", async () => {
    const { tx, log } = setup([[{ id: CURRENT }, { id: LEGACY }], [currentUser], [legacyUser]]);
    tx.execute.mockImplementation(async query => {
      const { text } = (await import("@/lib/db/__tests__/renderSql")).renderSql(query);
      if (text.includes("transfer_account_activity")) throw new Error("function does not exist");
      log.push({ kind: "execute", text });
      return [];
    });
    expect(await mergeAccounts(CURRENT, LEGACY)).toEqual({ success: false, error: "Merge failed" });
    expect(state.rolledBack).toBe(true);
    expect(log.map(({ kind }) => kind)).not.toContain("delete");
  });

  it("rolls back when an account disappeared before it was locked", async () => {
    const { log } = setup([[{ id: LEGACY }]]);
    expect(await mergeAccounts(CURRENT, LEGACY)).toEqual({ success: false, error: "Merge failed" });
    expect(state.rolledBack).toBe(true);
    expect(log).toHaveLength(2);
  });
});
