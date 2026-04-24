# Medication Draw-Up Calculator

> **Medical disclaimer**: This tool is for guidance only. Always verify doses, dilution
> instructions, and diluent compatibility with a pharmacist or authoritative drug reference
> before administration. It does not replace clinical judgement.

A fast, fully client-side web app that guides a clinician through drawing up a medication dose
from a vial and, when the raw volume is below 1 ml, calculating an exact dilution so the dose
can be administered in a safe, measurable 1 ml volume.

## Features

- Live calculation — no button press needed; result updates as you type.
- Unit conversion: dose in µg / mg / g; concentration in µg/ml / mg/ml / g/ml.
- Automatic dilution workflow when raw volume < 1 ml.
- Syringe recommendation from the standard set {1, 2, 5, 10, 20, 50 ml}.
- Warning for large doses exceeding 50 ml (split syringe required).
- Persistent medical disclaimer — always visible, cannot be dismissed.
- Responsive layout for 320 px phone screens and up.

## Dilution Algorithm

```
rawVolume = (dose [mg]) / (concentration [mg/ml])

if rawVolume >= 1 ml:
    administer rawVolume ml directly

if rawVolume < 1 ml:
    diluent   = 1 - rawVolume  (ml of compatible diluent, e.g. NaCl 0.9%)
    totalVol  = 1 ml
    administer the entire 1 ml syringe
    # concentration of mixture = dose / 1 ml
    # all 1 ml delivers the full dose ✓
```

## Local Development

**Requirements**: Node.js ≥ 18, pnpm ≥ 9.

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm test       # run Vitest unit tests
pnpm build      # production build → dist/
pnpm preview    # serve dist/ locally
```

## Deployment

The output is a fully static `dist/` folder. Deploy to any static host:

- **GitHub Pages**: push `dist/` or configure the Actions workflow to run `pnpm build`.
- **Netlify / Cloudflare Pages**: set build command `pnpm build`, publish directory `dist`.

No server, no database, no personal data transmitted.

## Scope & Limitations

| In scope | Out of scope |
|----------|-------------|
| Adult patients, standard IV/IM syringes (1–50 ml) | Paediatric weight-based dosing (mg/kg) |
| NaCl 0.9% as default diluent (always verify) | Drug-specific compatible diluent selection |
| Doses requiring single syringe ≤ 50 ml | Multi-syringe dose splitting |
