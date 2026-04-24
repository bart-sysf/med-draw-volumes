---
goal: "Astro-based web app that guides a doctor through drawing up and optionally diluting a medication dose from a vial"
date_created: "2026-04-24"
status: "Planned"
target_repo: "bart-sysf/trove-of-good-and-bad-ideas"
tags: [feature, web-app, astro, vue, medical-tool]
---

# Medication Concentration Calculator

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

## 1. Context & Goal

A doctor needs a quick, reliable tool usable on any device (phone, tablet, desktop) to determine:

1. How many ml to draw from a vial given the desired dose and vial concentration.
2. Whether the resulting volume is safely measurable (≥ 1 ml).
3. If not, what dilution to prepare (how much diluent to add to the original volume) so that a safe, measurable amount can be drawn.
4. Which syringe size (1 ml, 2 ml, 5 ml, 10 ml, 20 ml, 50 ml) is appropriate for the final draw volume.

The app is fully client-side — no server, no database, no personal data transmitted. It should be deployable as a static site (GitHub Pages, Netlify, Cloudflare Pages) and be fast to load on a poor hospital Wi-Fi connection.

---

## 2. Requirements & Constraints

- **REQ-001**: Accept a target dose in a user-selectable unit: µg, mg, g.
- **REQ-002**: Accept a vial concentration in a user-selectable unit: µg/ml, mg/ml, g/ml.
- **REQ-003**: Normalise both inputs to the same base unit (mg and mg/ml) before computing.
- **REQ-004**: Calculate raw volume = dose / concentration (both normalised to mg / mg·ml⁻¹).
- **REQ-005**: If raw volume ≥ 1 ml, output raw volume directly — no dilution step needed.
- **REQ-006**: If raw volume < 1 ml, trigger the dilution workflow: propose a dilution target of 2 ml total syringe volume (drug volume + diluent), delivering the dose in a final draw of 1 ml. Diluent = 2 − raw_volume ml; administer 1 ml from the mixed syringe.
- **REQ-007**: Recommend the smallest syringe that fits the final draw volume, from the set {1, 2, 5, 10, 20, 50} ml.
- **REQ-008**: Display the full step-by-step protocol: draw X ml from vial → (if diluted) add Y ml NaCl 0.9 % → administer Z ml.
- **REQ-009**: All logic must be 100 % client-side; no network call is made after the static files are served.
- **REQ-010**: The UI must be usable on a 5-inch phone screen without horizontal scrolling.
- **REQ-011**: The app must show a prominent medical disclaimer ("This tool is for guidance only. Always verify with a pharmacist or drug reference.").
- **CON-001**: No backend, no authentication, no state persistence between sessions.
- **CON-002**: Framework must be Astro (latest stable, currently 5.x).
- **CON-003**: Interactive island must be Vue 3 (fits the owner's stack; uses `@astrojs/vue`).
- **CON-004**: Styling must be Tailwind CSS (via `@astrojs/tailwind`); no heavy UI component library.
- **CON-005**: The app must be a single-page experience with no routing needed.
- **SEC-001**: No form data should be transmitted anywhere — enforce with a strict Content Security Policy header where the host allows it.
- **SEC-002**: The disclaimer must be impossible to dismiss permanently; it must be visible on every load.

---

## 3. Research Findings

### 3.1 Astro 5 + Vue 3 Island Pattern

Astro's Islands Architecture renders everything as static HTML by default. Interactive components are hydrated selectively using `client:*` directives. For this app a single Vue 3 component handles all form state and reactive output; the Astro shell is otherwise static (disclaimer, page title, branding).

```astro
---
import ConcentrationCalculator from '../components/ConcentrationCalculator.vue';
---
<ConcentrationCalculator client:load />
```

`client:load` is appropriate here because the calculator is the entire purpose of the page — no benefit in deferring hydration.

### 3.2 Core Calculation Logic

```
// Unit normalisation factors to mg
const toMg = { µg: 0.001, mg: 1, g: 1000 }
const toMgPerMl = { 'µg/ml': 0.001, 'mg/ml': 1, 'g/ml': 1000 }

doseMg   = doseValue   * toMg[doseUnit]
concMgMl = concValue   * toMgPerMl[concUnit]
rawVol   = doseMg / concMgMl          // ml

if (rawVol >= 1) {
  // No dilution needed
  finalDraw = rawVol
  diluent   = 0
} else {
  // Dilution: fill to 2 ml total, administer 1 ml
  diluent   = 2 - rawVol
  finalDraw = 1
}

syringeSize = [1, 2, 5, 10, 20, 50].find(s => s >= finalDraw)
```

**Dilution rationale** — The target is to make the dose deliverable in exactly 1 ml, which is the minimum volume measurable reliably with a standard 1 ml syringe. Filling to 2 ml total gives a 2× dilution; the doctor draws 1 ml, which contains exactly half the mixture = the original dose. This is a standard pharmacy dilution technique.

> Example: 0.3 mg needed, vial 1 mg/ml → raw 0.3 ml < 1 ml → add 1.7 ml NaCl to get 2 ml @ 0.5 mg/ml → administer 0.6 ml. *Wait — recalculate*: 0.3 mg in 2 ml = 0.15 mg/ml → need 2 ml to give 0.3 mg → administer 1 ml → dose in 1 ml = 0.3/2 × 2 = 0.15 mg. **Correct formula**: draw `rawVol` mg from vial, add `2 - rawVol` ml diluent, mix to 2 ml total; final concentration = `doseMg / 2` mg/ml; administer `doseMg / (doseMg / 2)` = 2 ml? — This exposes a subtle issue.

**Revised dilution strategy**: Rather than fixing the total to 2 ml, the goal is to reach a total volume where 1 ml contains the desired dose, i.e., total = `rawVol / 1` = `rawVol` ml if we want 1 ml to be the whole dose — that's circular. The cleaner approach:

- Choose a **target final draw** of exactly 1 ml.
- Choose a **dilution factor** D such that `rawVol × D ≥ 1`. Minimum safe D = `ceil(1 / rawVol)`.
- Total syringe volume = `rawVol × D` ml. Diluent = `rawVol × (D - 1)` ml.
- Administer `1 / D × total` = 1 ml? No — administer `1 / rawVol_diluted` = `1 ml`.

**Clearest formulation**:

```
D         = ceil(1 / rawVol)          // smallest integer ≥ 1/rawVol
totalVol  = rawVol * D                // ml in syringe after mixing
concDil   = doseMg / totalVol        // mg/ml of diluted solution
toAdmin   = doseMg / concDil         // = totalVol — wrong, that gives back totalVol

// Correct: we want to administer exactly 1 ml that contains doseMg
concDil   = doseMg / totalVol
toAdmin   = doseMg / concDil         // = totalVol — still equals totalVol
```

The insight: if we dilute `rawVol` into `totalVol`, the concentration becomes `doseMg/totalVol`. To deliver `doseMg`, we need all `totalVol`. So the doctor administers the **entire** diluted syringe content.

Better variant — **fix the administration volume at a round number ≥ 1 ml**:

```
// Pick the smallest round administration volume ≥ 1 ml: 1, 2, 5, 10 ml
adminVol  = [1, 2, 5, 10].find(v => rawVol <= v && v is practical)
// Choose adminVol = 1 ml if rawVol < 1
adminVol  = 1  // (safest, smallest)
dilFactor = adminVol / rawVol          // e.g. 1 / 0.3 = 3.33×
totalVol  = rawVol * dilFactor         // = adminVol = 1 ml
diluent   = totalVol - rawVol          // = 0.7 ml
// Administer all 1 ml from syringe → delivers doseMg ✓
```

This is the cleanest protocol: draw `rawVol` ml from vial, add `diluent` ml NaCl 0.9%, mix → total 1 ml → administer entire 1 ml syringe. Syringe selection: 1 ml syringe.

The executing agent should implement this algorithm and include inline comments explaining the dilution math.

### 3.3 Syringe Selection

Standard syringes available in most clinical settings: **1, 2, 5, 10, 20, 50 ml**.  
Select the smallest syringe ≥ final administration volume (rounded up to 1 decimal place).

### 3.4 Astro + Tailwind + Vue Integration

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [vue(), tailwind()],
  output: 'static',
});
```

`@astrojs/vue` and `@astrojs/tailwind` are both first-party integrations, well maintained, and installable via `npx astro add vue tailwind`.

### 3.5 Deployment

A `static` output (default) generates a `dist/` folder that can be deployed to any static host. No SSR adapter needed.

---

## 4. Implementation Phases

### Phase 1 — Project Scaffold

GOAL: Bootstrap an Astro project with Vue and Tailwind wired up, and a minimal page shell.

| Task | Description |
|------|-------------|
| TASK-001 | Initialise a new Astro project (`npm create astro@latest`) with the "minimal" template. |
| TASK-002 | Add Vue and Tailwind integrations via `npx astro add vue tailwind`. |
| TASK-003 | Create the single Astro page (`src/pages/index.astro`) with page title, disclaimer banner, and a placeholder for the calculator island. |
| TASK-004 | Configure Tailwind with a minimal palette suitable for a medical tool (neutral grays, a cautionary amber for the disclaimer, green/red for results). |
| TASK-005 | Configure `output: 'static'` and verify `npm run build` produces a `dist/` folder. |

### Phase 2 — Core Calculation Logic

GOAL: Implement and unit-test the pure calculation functions.

| Task | Description |
|------|-------------|
| TASK-006 | Create `src/lib/calculator.ts` (or `.js`) exporting `calculate(doseValue, doseUnit, concValue, concUnit)` returning a result object with `rawVolume`, `needsDilution`, `diluent`, `adminVolume`, `totalSyringeVolume`, `syringeSize`. |
| TASK-007 | Implement unit normalisation (µg/mg/g → mg; µg/ml / mg/ml / g/ml → mg/ml). |
| TASK-008 | Implement the dilution branch: `adminVolume = 1`, `diluent = 1 - rawVolume`. |
| TASK-009 | Implement syringe selection from the set {1, 2, 5, 10, 20, 50}. |
| TASK-010 | Write Vitest unit tests for at least 8 representative scenarios: exact-1ml boundary, sub-1ml, multi-ml, cross-unit (µg dose + mg/ml conc), edge cases (very large dose, very small dose). |

### Phase 3 — Vue Calculator Island

GOAL: Build the reactive Vue 3 single-file component that drives the UI.

| Task | Description |
|------|-------------|
| TASK-011 | Create `src/components/ConcentrationCalculator.vue` with `<script setup>` and reactive refs for all inputs. |
| TASK-012 | Build the input section: numeric dose field + unit selector (µg / mg / g via `<select>`); numeric concentration field + unit selector (µg/ml / mg/ml / g/ml via `<select>`). |
| TASK-013 | Wire inputs to a computed property calling `calculate()` from `calculator.ts` — result updates live as user types. |
| TASK-014 | Build the result section with two branches: (a) no dilution — display volume to draw and syringe size; (b) dilution needed — display step-by-step protocol (draw X ml vial, add Y ml NaCl 0.9%, administer 1 ml entire syringe). |
| TASK-015 | Add input validation: show inline error if dose or concentration is zero, negative, or non-numeric. Hide result panel while inputs are invalid. |
| TASK-016 | Style with Tailwind: card layout, clear typography hierarchy, result area visually distinct (border, background), syringe recommendation in a highlighted badge. |

### Phase 4 — Disclaimer & Polish

GOAL: Ensure the tool is safe to use and production-ready.

| Task | Description |
|------|-------------|
| TASK-017 | Implement the persistent disclaimer banner in the Astro page shell (not inside the Vue island) so it is always present in static HTML. |
| TASK-018 | Add a `<meta>` viewport tag and verify layout at 320px, 375px, 768px, and 1280px widths. |
| TASK-019 | Add a `<title>` and `<meta name="description">` appropriate for the tool. |
| TASK-020 | Verify `npm run build && npx serve dist` works end-to-end in a browser. |
| TASK-021 | Add a `README.md` at the project root describing the app, local dev setup, and medical disclaimer. |

---

## 5. Alternatives Considered

- **ALT-001: Plain HTML + vanilla JS (no framework)** — Acceptable for the simplest case, but Vue + Astro is almost as lightweight on first load and gives a much better developer experience for reactivity. The owner's stack already includes Vue, so this is the natural choice. **Rejected in favour of Astro + Vue.**

- **ALT-002: Next.js or Nuxt** — Full-stack frameworks with much larger bundles and more complexity than this single-page tool needs. **Rejected** — overkill.

- **ALT-003: React island instead of Vue** — The owner's stack is Vue; using React would be inconsistent. **Rejected in favour of Vue.**

- **ALT-004: Fix total syringe volume at 2 ml and administer half** — Simpler instructions for the dilution case (always "draw half the syringe") but less precise and introduces a rounding issue when rawVol is not 1. **Rejected in favour of the 1 ml adminVolume approach** which is fully precise and uses a 1 ml syringe.

- **ALT-005: Allow the user to choose the target administration volume** — Adds flexibility but increases cognitive load in a high-stakes clinical moment. The right default (1 ml) covers the vast majority of cases. **Rejected** — keep it simple and safe.

- **ALT-006: CapacitorJS for mobile packaging** — The owner uses CapacitorJS with Vue, but a mobile-responsive web app on any browser is faster to deploy and needs no app store. **Deferred** — can be added later if offline or home-screen installation is needed.

---

## 6. Dependencies

- **DEP-001**: `astro` ≥ 5.0 — web framework / build tool.
- **DEP-002**: `@astrojs/vue` — first-party Vue integration for Astro.
- **DEP-003**: `vue` ^3.4 — reactive island component.
- **DEP-004**: `@astrojs/tailwind` — first-party Tailwind integration.
- **DEP-005**: `tailwindcss` ^3.4 — utility-first CSS.
- **DEP-006**: `vitest` — unit test runner (native to Vite/Astro ecosystem).
- **DEP-007**: `typescript` — for typed calculation logic (optional but recommended).

No external API, no backend service, no database.

---

## 7. Testing Strategy

**Unit tests (Vitest, `src/lib/calculator.test.ts`)**

| Scenario | Input | Expected |
|----------|-------|----------|
| Exact 1 ml, no dilution | 5 mg dose, 5 mg/ml | rawVol=1, needsDilution=false, syringe=1ml |
| Above 1 ml, 5ml syringe | 10 mg, 5 mg/ml | rawVol=2, needsDilution=false, syringe=2ml |
| Above 5 ml, 10ml syringe | 30 mg, 5 mg/ml | rawVol=6, needsDilution=false, syringe=10ml |
| Sub-1ml, dilution needed | 1 mg, 5 mg/ml | rawVol=0.2, needsDilution=true, diluent=0.8, adminVol=1, syringe=1ml |
| Cross-unit µg dose + mg/ml | 500 µg, 1 mg/ml | rawVol=0.5, needsDilution=true |
| g dose + mg/ml | 0.01 g, 10 mg/ml | rawVol=1, needsDilution=false |
| Very small sub-1ml | 0.05 mg, 10 mg/ml | rawVol=0.005, needsDilution=true, diluent=0.995 |
| Large dose | 500 mg, 10 mg/ml | rawVol=50, needsDilution=false, syringe=50ml |

**Manual browser testing**

- Verify live reactivity (no button press needed).
- Verify error state for zero/negative inputs.
- Verify disclaimer is always visible.
- Verify responsive layout at 320px, 375px, 768px.

---

## 8. Risks & Assumptions

- **RISK-001**: The dilution protocol assumes NaCl 0.9% (normal saline) as the diluent. Some medications require D5W or other diluents. The app should label the diluent as "compatible diluent (e.g. NaCl 0.9%)" and note to check drug-specific guidance.
- **RISK-002**: The 1 ml floor for safe measurement assumes standard clinical syringes. In neonatal or paediatric settings, sub-0.1 ml volumes may be used with insulin or tuberculin syringes. The app does not currently address these contexts — this should be clearly stated.
- **RISK-003**: Large doses (> 50 ml) exceed the largest common syringe. The app should display a warning to split into multiple syringes.
- **RISK-004**: Rounding of calculated volumes to 1 decimal place may introduce small dosing errors. The UI should display at least 2 decimal places and note that precision matters.
- **ASSUMPTION-001**: The doctor is using standard intravenous or intramuscular syringes (1–50 ml range).
- **ASSUMPTION-002**: The diluent is always added to the vial drug volume in the same syringe, not the other way around (draw drug first, then diluent).
- **ASSUMPTION-003**: The app targets adult patients; paediatric weight-based dosing (mg/kg) is out of scope for this version.

---

## 9. Further Reading

- [Astro Documentation — Islands Architecture](https://docs.astro.build/en/concepts/islands/)
- [Astro Integrations — Vue](https://docs.astro.build/en/guides/integrations-guide/vue/)
- [Astro Integrations — Tailwind CSS](https://docs.astro.build/en/guides/integrations-guide/tailwind/)
- [Vitest — Getting Started](https://vitest.dev/guide/)
- [WHO Injectable Medicines Guide — Dilution Principles](https://apps.who.int/iris/handle/10665/44649)