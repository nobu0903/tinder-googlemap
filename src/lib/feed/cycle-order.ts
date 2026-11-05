export type CycleSlot = "classic" | "vibe";

/**
 * Shuffle which seats in one cycle are classic. The counts stay put:
 * 3 classic and 7 vibe still means 3 famous cards per 10, just not always first.
 */
export function cycleSlotOrder(
  classicCount: number,
  vibeCount: number,
  random: () => number = Math.random,
): CycleSlot[] {
  const slots: CycleSlot[] = [];
  for (let i = 0; i < classicCount; i++) slots.push("classic");
  for (let i = 0; i < vibeCount; i++) slots.push("vibe");
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const current = slots[i]!;
    slots[i] = slots[j]!;
    slots[j] = current;
  }
  return slots;
}

export function takeShuffledCycle<T>(opts: {
  classic: T[];
  classicIndex: number;
  vibe: T[];
  vibeIndex: number;
  classicSlots: number;
  vibeSlots: number;
  limit: number;
  random?: () => number;
}): {
  items: Array<{ item: T; source: CycleSlot }>;
  classicIndex: number;
  vibeIndex: number;
} {
  const classicLeft = Math.max(0, opts.classic.length - opts.classicIndex);
  const vibeLeft = Math.max(0, opts.vibe.length - opts.vibeIndex);
  const classicTake = Math.min(opts.classicSlots, classicLeft, opts.limit);
  const vibeTake = Math.min(opts.vibeSlots, vibeLeft, opts.limit - classicTake);
  const order = cycleSlotOrder(classicTake, vibeTake, opts.random);

  const items: Array<{ item: T; source: CycleSlot }> = [];
  let classicIndex = opts.classicIndex;
  let vibeIndex = opts.vibeIndex;
  for (const source of order) {
    if (source === "classic") {
      items.push({ item: opts.classic[classicIndex++] as T, source });
    } else {
      items.push({ item: opts.vibe[vibeIndex++] as T, source });
    }
  }
  return { items, classicIndex, vibeIndex };
}
