import { describe, expect, it, vi } from "vitest";
import { closeScratchDatabase } from "./fixtures/closeScratchDatabase";

const fakes = (clientEnd = vi.fn().mockResolvedValue(undefined)) => {
  const order: string[] = [];
  const client = { end: vi.fn(async () => (order.push("client.end"), clientEnd())) };
  const admin = {
    unsafe: vi.fn(async (q: string) => void order.push(q)),
    end: vi.fn(async () => void order.push("admin.end")),
  };
  return { client, admin, order };
};

describe("closeScratchDatabase", () => {
  it("closes the client, drops the scratch database, then closes the admin connection", async () => {
    const { client, admin, order } = fakes();
    await closeScratchDatabase({ client, admin, scratch: "units_vector_1" });
    expect(order).toEqual([
      "client.end",
      "drop database if exists units_vector_1 with (force)",
      "admin.end",
    ]);
  });

  it("still drops the database and closes the admin connection when closing the client rejects", async () => {
    const { client, admin, order } = fakes(vi.fn().mockRejectedValue(new Error("end failed")));
    await expect(
      closeScratchDatabase({ client, admin, scratch: "units_vector_2" }),
    ).rejects.toThrow("end failed");
    expect(order).toEqual([
      "client.end",
      "drop database if exists units_vector_2 with (force)",
      "admin.end",
    ]);
  });

  it("does nothing it has no connection for", async () => {
    await expect(closeScratchDatabase({ scratch: "" })).resolves.toBeUndefined();
    const { admin, order } = fakes();
    await closeScratchDatabase({ admin, scratch: "" });
    expect(order).toEqual(["admin.end"]);
  });
});
