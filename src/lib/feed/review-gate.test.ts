import { describe, expect, it } from "vitest";
import { passesReviewGate, reviewGateOrFilter } from "@/lib/feed/review-gate";

describe("passesReviewGate", () => {
  it("accepts spots at or above the full review floor regardless of rating", () => {
    expect(passesReviewGate({ user_rating_count: 60, rating: 2.1 }, 60)).toBe(true);
    expect(passesReviewGate({ user_rating_count: 61, rating: null }, 60)).toBe(true);
  });

  it("accepts 20–59 reviews only with a rating of 3.0 or more", () => {
    expect(passesReviewGate({ user_rating_count: 20, rating: 3.0 }, 60)).toBe(true);
    expect(passesReviewGate({ user_rating_count: 59, rating: 4.6 }, 60)).toBe(true);
    expect(passesReviewGate({ user_rating_count: 40, rating: 2.9 }, 60)).toBe(false);
    expect(passesReviewGate({ user_rating_count: 40, rating: null }, 60)).toBe(false);
  });

  it("rejects fewer than 20 reviews or an unknown count", () => {
    expect(passesReviewGate({ user_rating_count: 19, rating: 5 }, 60)).toBe(false);
    expect(passesReviewGate({ user_rating_count: null, rating: 5 }, 60)).toBe(false);
    expect(passesReviewGate({ user_rating_count: undefined, rating: 5 }, 60)).toBe(false);
  });
});

describe("reviewGateOrFilter", () => {
  it("encodes the same two branches for the database query", () => {
    expect(reviewGateOrFilter(60)).toBe(
      "user_rating_count.gte.60,and(user_rating_count.gte.20,rating.gte.3)",
    );
  });
});
