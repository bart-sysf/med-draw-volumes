import { describe, it, expect } from 'vitest';
import { calculate } from './calculator';

// Helper: round to 6 decimal places for float comparison
const r = (n: number) => Math.round(n * 1e6) / 1e6;

describe('calculate()', () => {
  it('exact 1 ml — no dilution, 1 ml syringe', () => {
    const res = calculate(5, 'mg', 5, 'mg/ml');
    expect(r(res.rawVolume)).toBe(1);
    expect(res.needsDilution).toBe(false);
    expect(res.diluent).toBe(0);
    expect(r(res.adminVolume)).toBe(1);
    expect(res.syringeSize).toBe(1);
    expect(res.warning).toBeNull();
  });

  it('above 1 ml — 2 ml syringe', () => {
    const res = calculate(10, 'mg', 5, 'mg/ml');
    expect(r(res.rawVolume)).toBe(2);
    expect(res.needsDilution).toBe(false);
    expect(r(res.adminVolume)).toBe(2);
    expect(res.syringeSize).toBe(2);
  });

  it('above 5 ml — 10 ml syringe', () => {
    const res = calculate(30, 'mg', 5, 'mg/ml');
    expect(r(res.rawVolume)).toBe(6);
    expect(res.needsDilution).toBe(false);
    expect(res.syringeSize).toBe(10);
  });

  it('sub-1 ml — dilution needed, 5 ml syringe for 5 ml total', () => {
    const res = calculate(1, 'mg', 5, 'mg/ml');
    expect(r(res.rawVolume)).toBe(0.2);
    expect(res.needsDilution).toBe(true);
    expect(res.drawFromVial).toBe(1);
    expect(r(res.diluent)).toBe(4.0);   // ceil(1/0.2 - 1, 1 dec) = 4.0
    expect(r(res.totalSyringeVolume)).toBe(5.0); // 1 + 4.0
    expect(r(res.adminVolume)).toBe(1); // 0.2 * 5.0 = 1.0
    expect(res.syringeSize).toBe(5);   // totalSyringeVolume = 5.0 ml
  });

  it('cross-unit: µg dose + mg/ml conc — sub-1 ml', () => {
    // 500 µg = 0.5 mg; 1 mg/ml → rawVol = 0.5 ml; totalSyringeVolume = 1 + 1.0 = 2.0 ml
    const res = calculate(500, 'µg', 1, 'mg/ml');
    expect(r(res.rawVolume)).toBe(0.5);
    expect(res.needsDilution).toBe(true);
    expect(res.drawFromVial).toBe(1);
    expect(r(res.diluent)).toBe(1.0);  // ceil(1/0.5 - 1, 1 dec) = 1.0
    expect(r(res.adminVolume)).toBe(1); // 0.5 * 2.0 = 1.0
    expect(res.syringeSize).toBe(2);   // totalSyringeVolume = 2.0 ml
  });

  it('cross-unit: g dose + mg/ml conc — exact 1 ml', () => {
    // 0.01 g = 10 mg; 10 mg/ml → rawVol = 1 ml
    const res = calculate(0.01, 'g', 10, 'mg/ml');
    expect(r(res.rawVolume)).toBe(1);
    expect(res.needsDilution).toBe(false);
    expect(res.syringeSize).toBe(1);
  });

  it('very small sub-1 ml — large diluent fraction', () => {
    // 0.05 mg / 10 mg/ml = 0.005 ml; totalSyringeVolume = 1 + 199.0 = 200 ml > 50 → null syringe
    const res = calculate(0.05, 'mg', 10, 'mg/ml');
    expect(r(res.rawVolume)).toBe(0.005);
    expect(res.needsDilution).toBe(true);
    expect(res.drawFromVial).toBe(1);
    expect(r(res.diluent)).toBe(199.0); // ceil(1/0.005 - 1, 1 dec) = 199.0
    expect(r(res.adminVolume)).toBe(1); // 0.005 * 200.0 = 1.0
    expect(res.syringeSize).toBeNull(); // totalSyringeVolume = 200 ml > 50
    expect(res.warning).not.toBeNull();
  });

  it('large dose — 50 ml syringe', () => {
    // 500 mg / 10 mg/ml = 50 ml
    const res = calculate(500, 'mg', 10, 'mg/ml');
    expect(r(res.rawVolume)).toBe(50);
    expect(res.needsDilution).toBe(false);
    expect(res.syringeSize).toBe(50);
    expect(res.warning).toBeNull();
  });

  it('very large dose > 50 ml — warning, null syringe', () => {
    // 600 mg / 10 mg/ml = 60 ml
    const res = calculate(600, 'mg', 10, 'mg/ml');
    expect(r(res.rawVolume)).toBe(60);
    expect(res.needsDilution).toBe(false);
    expect(res.syringeSize).toBeNull();
    expect(res.warning).not.toBeNull();
  });

  it('cross-unit: mg dose + µg/ml conc — large rawVol', () => {
    // 1 mg = 1000 µg; 500 µg/ml → rawVol = 2 ml
    const res = calculate(1, 'mg', 500, 'µg/ml');
    expect(r(res.rawVolume)).toBe(2);
    expect(res.needsDilution).toBe(false);
    expect(res.syringeSize).toBe(2);
  });
});
