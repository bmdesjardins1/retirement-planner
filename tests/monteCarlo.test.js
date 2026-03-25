import { describe, it, expect } from "vitest";
import { runMonteCarlo } from "../src/utils/monteCarlo";

// Minimal yearsData covering a 10-year drawdown
function makeYearsData(retirementAge, years, annualWithdrawal) {
  return Array.from({ length: years }, (_, i) => ({
    age: retirementAge + i,
    portfolio: 0,
    withdrawal: annualWithdrawal,
    income: 0,
    expenses: 0,
  }));
}

describe("runMonteCarlo", () => {
  const base = {
    portfolioAtRetirement: 1_000_000,
    investmentReturn: 5,
    retirementAge: 65,
    effectiveLifeExpectancy: 88,
    simCount: 200, // smaller count for test speed
  };

  it("successRate is between 0 and 100", () => {
    const yearsData = makeYearsData(65, 30, 40_000);
    const { successRate } = runMonteCarlo({ ...base, yearsData });
    expect(successRate).toBeGreaterThanOrEqual(0);
    expect(successRate).toBeLessThanOrEqual(100);
  });

  it("bands length equals number of drawdown years", () => {
    const yearsData = makeYearsData(65, 30, 40_000);
    const { bands } = runMonteCarlo({ ...base, yearsData });
    expect(bands.length).toBe(30);
  });

  it("p10 ≤ p50 ≤ p90 for every year", () => {
    const yearsData = makeYearsData(65, 30, 40_000);
    const { bands } = runMonteCarlo({ ...base, yearsData });
    for (const b of bands) {
      expect(b.p10).toBeLessThanOrEqual(b.p50);
      expect(b.p50).toBeLessThanOrEqual(b.p90);
    }
  });

  it("returns successRate=100 with massive portfolio and tiny withdrawals", () => {
    const yearsData = makeYearsData(65, 10, 1_000); // $1k/yr from $10M
    const { successRate } = runMonteCarlo({
      ...base,
      portfolioAtRetirement: 10_000_000,
      yearsData,
    });
    // With 10M and only $1k/yr withdrawal, virtually all simulations survive
    expect(successRate).toBeGreaterThan(95);
  });

  it("returns low successRate with unsustainable withdrawals", () => {
    const yearsData = makeYearsData(65, 30, 200_000); // $200k/yr from $500k
    const { successRate } = runMonteCarlo({
      ...base,
      portfolioAtRetirement: 500_000,
      yearsData,
    });
    expect(successRate).toBeLessThan(30);
  });

  it("returns empty bands when no drawdown years exist", () => {
    const { successRate, bands } = runMonteCarlo({ ...base, yearsData: [] });
    expect(successRate).toBe(100);
    expect(bands).toHaveLength(0);
  });

  it("medianFailureAge is null when all simulations succeed", () => {
    const yearsData = makeYearsData(65, 10, 1_000);
    const { medianFailureAge } = runMonteCarlo({
      ...base,
      portfolioAtRetirement: 10_000_000,
      yearsData,
    });
    expect(medianFailureAge).toBeNull();
  });

  it("medianFailureAge is a number within the drawdown age range when failures occur", () => {
    const yearsData = makeYearsData(65, 20, 300_000);
    const { medianFailureAge } = runMonteCarlo({
      ...base,
      portfolioAtRetirement: 200_000,
      yearsData,
    });
    expect(medianFailureAge).not.toBeNull();
    expect(medianFailureAge).toBeGreaterThanOrEqual(65);
    expect(medianFailureAge).toBeLessThanOrEqual(84); // 65 + 20 - 1
  });

  it("p10DepletionAge is null when p10 never hits $0", () => {
    const yearsData = makeYearsData(65, 10, 1_000);
    const { p10DepletionAge } = runMonteCarlo({
      ...base,
      portfolioAtRetirement: 10_000_000,
      yearsData,
    });
    expect(p10DepletionAge).toBeNull();
  });

  it("p10DepletionAge equals the first band age where p10 === 0 exactly", () => {
    const yearsData = makeYearsData(65, 25, 150_000);
    const { bands, p10DepletionAge } = runMonteCarlo({
      ...base,
      portfolioAtRetirement: 400_000,
      yearsData,
    });
    const firstZeroBand = bands.find(b => b.p10 === 0);
    if (firstZeroBand) {
      expect(p10DepletionAge).toBe(firstZeroBand.age);
    } else {
      expect(p10DepletionAge).toBeNull();
    }
  });
});
