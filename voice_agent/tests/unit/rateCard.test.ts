import { getRateCardFor } from "../../src/services/intake/rateCard";

describe("rateCard", () => {
  it("returns correct entry for known incident type", () => {
    const r = getRateCardFor("auto_accident");
    expect(r.contingency_pct).toBe(33);
    expect(r.consult_fee_usd).toBe(0);
  });

  it("falls back to default for unknown type", () => {
    const r = getRateCardFor("nonsense_type");
    expect(r.contingency_pct).toBeGreaterThan(0);
  });
});
