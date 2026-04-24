/**
 * Medication Concentration Calculator — Core Logic
 *
 * All calculation is purely functional and unit-tested. No side-effects.
 */

export type DoseUnit = 'µg' | 'mg' | 'g';
export type ConcUnit = 'µg/ml' | 'mg/ml' | 'g/ml';

export interface CalcResult {
  /** Theoretical volume = dose / concentration (ml) */
  rawVolume: number;
  /**
   * Actual volume to draw from the vial (ml).
   * Always 1 ml when needsDilution is true (minimum measurable draw).
   * Equals rawVolume when no dilution is needed.
   */
  drawFromVial: number;
  /** True when rawVolume < 1 ml and a dilution step is required */
  needsDilution: boolean;
  /**
   * ml of compatible diluent to add to the syringe.
   * Rounded up to 1 decimal place when needsDilution is true, otherwise 0.
   */
  diluent: number;
  /**
   * Volume to administer from the mixture (ml).
   * = rawVolume × totalSyringeVolume — the fraction of the mixture that contains the full dose.
   */
  adminVolume: number;
  /**
   * Total volume in the syringe after mixing (ml).
   * = drawFromVial + diluent
   */
  totalSyringeVolume: number;
  /**
   * Smallest standard syringe (ml) that fits adminVolume.
   * null when adminVolume > 50 ml (must split).
   */
  syringeSize: number | null;
  /** Warning message when adminVolume > 50 ml */
  warning: string | null;
}

// Normalisation factors → mg
const toMg: Record<DoseUnit, number> = { µg: 0.001, mg: 1, g: 1000 };
// Normalisation factors → mg/ml
const toMgPerMl: Record<ConcUnit, number> = { 'µg/ml': 0.001, 'mg/ml': 1, 'g/ml': 1000 };

const SYRINGES = [1, 2, 5, 10, 20, 50] as const;

/**
 * Select the smallest standard syringe that fits `volume` ml.
 * Returns null if no standard syringe is large enough (> 50 ml).
 */
function pickSyringe(volume: number): number | null {
  return SYRINGES.find((s) => s >= volume) ?? null;
}

/**
 * Calculate draw/dilution instructions for a given dose and vial concentration.
 *
 * @param doseValue  Numeric dose amount (must be > 0)
 * @param doseUnit   Unit of the dose
 * @param concValue  Numeric concentration of the vial (must be > 0)
 * @param concUnit   Unit of the concentration
 */
export function calculate(
  doseValue: number,
  doseUnit: DoseUnit,
  concValue: number,
  concUnit: ConcUnit,
): CalcResult {
  // Normalise both values to mg / mg·ml⁻¹
  const doseMg = doseValue * toMg[doseUnit];
  const concMgMl = concValue * toMgPerMl[concUnit];

  // Volume of drug to draw from vial (ml)
  const rawVolume = doseMg / concMgMl;

  let drawFromVial: number;
  let diluent: number;
  let adminVolume: number;
  let totalSyringeVolume: number;

  if (rawVolume >= 1) {
    // No dilution needed — draw rawVolume directly
    drawFromVial = rawVolume;
    diluent = 0;
    adminVolume = rawVolume;
    totalSyringeVolume = rawVolume;
  } else {
    /**
     * Dilution workflow:
     *   Draw exactly 1 ml from the vial (minimum reliably measurable volume).
     *   The 1 ml drawn contains 1 × concMgMl mg — more than the needed doseMg.
     *
     *   To deliver doseMg in a measurable volume we dilute:
     *     exactDiluent = (1 / rawVolume) − 1   [ml of saline to add]
     *     totalVol     = 1 + exactDiluent = 1 / rawVolume
     *     adminVolume  = rawVolume × totalVol   = doseMg / concMgMl × (1 / rawVolume) × concMgMl / concMgMl
     *                  = rawVolume × totalVol   → delivers doseMg exactly ✓
     *
     *   We round exactDiluent UP to 1 decimal place so the doctor measures a tidy amount;
     *   this causes adminVolume to be rawVolume × (1 + diluent_rounded), which is ≥ 1 ml.
     */
    drawFromVial = 1;
    diluent = Math.ceil((1 / rawVolume - 1) * 10) / 10;
    totalSyringeVolume = 1 + diluent;
    // adminVolume: the fraction of totalSyringeVolume that contains doseMg
    adminVolume = rawVolume * totalSyringeVolume;
  }

  // Syringe must fit the total mixing volume (drawFromVial + diluent).
  const syringeSize = pickSyringe(totalSyringeVolume);
  const warning =
    syringeSize === null
      ? `Total mixing volume (${totalSyringeVolume.toFixed(1)} ml) exceeds 50 ml. ` +
        'Split into multiple syringes and verify with a pharmacist.'
      : null;

  return {
    rawVolume,
    drawFromVial,
    needsDilution: rawVolume < 1,
    diluent,
    adminVolume,
    totalSyringeVolume,
    syringeSize,
    warning,
  };
}
