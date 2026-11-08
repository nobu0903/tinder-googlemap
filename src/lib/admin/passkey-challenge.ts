export type ChallengePurpose = "authentication" | "registration";

export type ChallengeStore = {
  put(
    challenge: string,
    purpose: ChallengePurpose,
    expiresAtMs: number,
  ): Promise<void>;
  /**
   * Deletes the challenge whether the rest of the check succeeds or not.
   * Returns true only when it existed, had this purpose, and was unexpired.
   */
  consume(
    challenge: string,
    purpose: ChallengePurpose,
    nowMs: number,
  ): Promise<boolean>;
};

export function createMemoryChallengeStore(): ChallengeStore {
  const rows = new Map<
    string,
    { purpose: ChallengePurpose; expiresAtMs: number }
  >();
  return {
    async put(challenge, purpose, expiresAtMs) {
      rows.set(challenge, { purpose, expiresAtMs });
    },
    async consume(challenge, purpose, nowMs) {
      const row = rows.get(challenge);
      if (!row) return false;
      rows.delete(challenge);
      if (row.purpose !== purpose) return false;
      if (row.expiresAtMs <= nowMs) return false;
      return true;
    },
  };
}
