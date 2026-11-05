import { describe, expect, it } from "vitest";
import { cycleSlotOrder, takeShuffledCycle } from "@/lib/feed/cycle-order";

/** First draw swaps the ends; every later draw swaps an item with itself. */
function vibeFirst(): () => number {
  let calls = 0;
  return () => (calls++ === 0 ? 0 : 0.999);
}

describe("cycleSlotOrder", () => {
  it("keeps a self-swap sequence in classic-then-vibe order", () => {
    const order = cycleSlotOrder(3, 7, () => 0.999);
    expect(order).toEqual([
      "classic",
      "classic",
      "classic",
      "vibe",
      "vibe",
      "vibe",
      "vibe",
      "vibe",
      "vibe",
      "vibe",
    ]);
  });

  it("can place a vibe card first when the shuffle says so", () => {
    const order = cycleSlotOrder(3, 7, vibeFirst());
    expect(order[0]).toBe("vibe");
    expect(order.filter((slot) => slot === "classic")).toHaveLength(3);
    expect(order.filter((slot) => slot === "vibe")).toHaveLength(7);
  });
});

describe("takeShuffledCycle", () => {
  it("draws 3 classic and 7 vibe, then continues with what is left", () => {
    const classic = ["A", "B", "C", "D"];
    const vibe = ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8"];
    const first = takeShuffledCycle({
      classic,
      classicIndex: 0,
      vibe,
      vibeIndex: 0,
      classicSlots: 3,
      vibeSlots: 7,
      limit: 20,
      random: vibeFirst(),
    });
    expect(first.items.filter((item) => item.source === "classic")).toHaveLength(3);
    expect(first.items.filter((item) => item.source === "vibe")).toHaveLength(7);
    expect(first.items[0]?.source).toBe("vibe");
    expect(first.classicIndex).toBe(3);
    expect(first.vibeIndex).toBe(7);

    const second = takeShuffledCycle({
      classic,
      classicIndex: first.classicIndex,
      vibe,
      vibeIndex: first.vibeIndex,
      classicSlots: 3,
      vibeSlots: 7,
      limit: 20,
      random: () => 0,
    });
    expect(second.items.map((item) => item.item)).toEqual(["v8", "D"]);
    expect(second.items.map((item) => item.source)).toEqual(["vibe", "classic"]);
  });

  it("stops at the remaining room without dropping the ratio's classic seats first", () => {
    const cycle = takeShuffledCycle({
      classic: ["A", "B", "C"],
      classicIndex: 0,
      vibe: ["v1", "v2", "v3", "v4", "v5", "v6", "v7"],
      vibeIndex: 0,
      classicSlots: 3,
      vibeSlots: 7,
      limit: 4,
      random: () => 0.999,
    });
    expect(cycle.items.map((item) => item.source)).toEqual([
      "classic",
      "classic",
      "classic",
      "vibe",
    ]);
  });
});
