<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { calculate, type DoseUnit, type ConcUnit } from '../lib/calculator';

const doseValue = ref<string>('');
const doseUnit = ref<DoseUnit>('mg');
const concValue = ref<string>('');
const concUnit = ref<ConcUnit>('mg/ml');

const DOSE_UNITS: DoseUnit[] = ['µg', 'mg', 'g'];
const CONC_UNITS: ConcUnit[] = ['µg/ml', 'mg/ml', 'g/ml'];

// ---------- Weight-based dosing ----------
type WeightDoseUnit = 'µg/kg' | 'mg/kg' | 'g/kg';
const WEIGHT_DOSE_UNITS: WeightDoseUnit[] = ['µg/kg', 'mg/kg', 'g/kg'];

const useWeightBased = ref(false);
const weightValue = ref<string>('');
const dosePerKgValue = ref<string>('');
const dosePerKgUnit = ref<WeightDoseUnit>('mg/kg');

const weightDoseUnitToDoseUnit: Record<WeightDoseUnit, DoseUnit> = {
  'µg/kg': 'µg',
  'mg/kg': 'mg',
  'g/kg': 'g',
};

const weightError = computed(() => {
  if (!useWeightBased.value || weightValue.value === '') return null;
  const n = Number(weightValue.value);
  if (isNaN(n) || n <= 0) return 'Weight must be a positive number.';
  return null;
});

const dosePerKgError = computed(() => {
  if (!useWeightBased.value || dosePerKgValue.value === '') return null;
  const n = Number(dosePerKgValue.value);
  if (isNaN(n) || n <= 0) return 'Dose per kg must be a positive number.';
  return null;
});

// Keep doseValue / doseUnit in sync when weight-based mode is active
watch(
  [useWeightBased, weightValue, dosePerKgValue, dosePerKgUnit],
  () => {
    if (!useWeightBased.value) return;
    const w = Number(weightValue.value);
    const d = Number(dosePerKgValue.value);
    if (!isNaN(w) && w > 0 && !isNaN(d) && d > 0) {
      doseValue.value = String(w * d);
      doseUnit.value = weightDoseUnitToDoseUnit[dosePerKgUnit.value];
    } else {
      doseValue.value = '';
    }
  },
);

function toggleWeightBased() {
  useWeightBased.value = !useWeightBased.value;
  if (!useWeightBased.value) {
    // Restore manual entry: clear the auto-populated dose so user starts fresh
    doseValue.value = '';
    weightValue.value = '';
    dosePerKgValue.value = '';
  }
}
// -----------------------------------------

/** Validation errors */
const doseError = computed(() => {
  if (doseValue.value === '') return null;
  const n = Number(doseValue.value);
  if (isNaN(n) || n <= 0) return 'Dose must be a positive number.';
  return null;
});

const concError = computed(() => {
  if (concValue.value === '') return null;
  const n = Number(concValue.value);
  if (isNaN(n) || n <= 0) return 'Concentration must be a positive number.';
  return null;
});

const inputsValid = computed(
  () =>
    doseValue.value !== '' &&
    concValue.value !== '' &&
    doseError.value === null &&
    concError.value === null,
);

const result = computed(() => {
  if (!inputsValid.value) return null;
  return calculate(Number(doseValue.value), doseUnit.value, Number(concValue.value), concUnit.value);
});

/** Format a number to at most 3 significant decimal places, trimming trailing zeros */
function fmt(n: number): string {
  // Show at least 2 decimal places for clinical precision
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
</script>

<template>
  <div class="max-w-lg mx-auto px-4 py-6 space-y-6">
    <!-- Input card -->
    <div class="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 space-y-5">
      <h2 class="text-lg font-semibold text-gray-800 tracking-tight">Enter dose &amp; vial concentration</h2>

      <!-- Weight-based toggle -->
      <div class="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          :aria-checked="useWeightBased"
          @click="toggleWeightBased"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          :class="useWeightBased ? 'bg-blue-600' : 'bg-gray-300'"
          aria-label="Calculate dose from weight"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
            :class="useWeightBased ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
        <span class="text-sm font-medium text-gray-700">Calculate dose from weight</span>
      </div>

      <!-- Weight-based fields (shown when toggle is on) -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div v-if="useWeightBased" class="space-y-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-4">
          <!-- Weight row -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Patient weight</label>
            <div class="flex gap-2">
              <input
                v-model="weightValue"
                type="number"
                inputmode="decimal"
                min="0"
                step="any"
                placeholder="e.g. 70"
                class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                :class="weightError ? 'border-red-400 focus:ring-red-400' : ''"
                aria-label="Patient weight in kg"
              />
              <span class="inline-flex items-center rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-600 select-none">kg</span>
            </div>
            <p v-if="weightError" class="mt-1 text-xs text-red-600" role="alert">{{ weightError }}</p>
          </div>

          <!-- Dose per kg row -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Dose per kg</label>
            <div class="flex gap-2">
              <input
                v-model="dosePerKgValue"
                type="number"
                inputmode="decimal"
                min="0"
                step="any"
                placeholder="e.g. 0.1"
                class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                :class="dosePerKgError ? 'border-red-400 focus:ring-red-400' : ''"
                aria-label="Dose per kg amount"
              />
              <select
                v-model="dosePerKgUnit"
                class="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Dose per kg unit"
              >
                <option v-for="u in WEIGHT_DOSE_UNITS" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
            <p v-if="dosePerKgError" class="mt-1 text-xs text-red-600" role="alert">{{ dosePerKgError }}</p>
          </div>
        </div>
      </Transition>

      <!-- Dose row -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Desired dose
          <span v-if="useWeightBased" class="ml-1 text-xs font-normal text-blue-600">(auto-calculated)</span>
        </label>
        <div class="flex gap-2">
          <input
            v-model="doseValue"
            type="number"
            inputmode="decimal"
            min="0"
            step="any"
            placeholder="e.g. 5"
            class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            :class="[doseError ? 'border-red-400 focus:ring-red-400' : '', useWeightBased ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : '']"
            :readonly="useWeightBased"
            aria-label="Dose amount"
          />
          <select
            v-model="doseUnit"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            :disabled="useWeightBased"
            aria-label="Dose unit"
          >
            <option v-for="u in DOSE_UNITS" :key="u" :value="u">{{ u }}</option>
          </select>
        </div>
        <p v-if="doseError" class="mt-1 text-xs text-red-600" role="alert">{{ doseError }}</p>
      </div>

      <!-- Concentration row -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Vial concentration</label>
        <div class="flex gap-2">
          <input
            v-model="concValue"
            type="number"
            inputmode="decimal"
            min="0"
            step="any"
            placeholder="e.g. 10"
            class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            :class="concError ? 'border-red-400 focus:ring-red-400' : ''"
            aria-label="Concentration amount"
          />
          <select
            v-model="concUnit"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Concentration unit"
          >
            <option v-for="u in CONC_UNITS" :key="u" :value="u">{{ u }}</option>
          </select>
        </div>
        <p v-if="concError" class="mt-1 text-xs text-red-600" role="alert">{{ concError }}</p>
      </div>
    </div>

    <!-- Result card — only shown when inputs are valid -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div
        v-if="result"
        class="rounded-2xl border border-blue-200 bg-blue-50 shadow-sm p-6 space-y-4"
        aria-live="polite"
      >
        <h2 class="text-lg font-semibold text-blue-900 tracking-tight">Protocol</h2>

        <!-- Large-volume warning -->
        <div
          v-if="result.warning"
          class="rounded-lg bg-red-100 border border-red-300 text-red-800 text-sm px-4 py-3 font-medium"
          role="alert"
        >
          ⚠ {{ result.warning }}
        </div>

        <!-- Steps -->
        <ol class="space-y-3 list-none">
          <!-- Step 1: draw from vial -->
          <li class="flex gap-3">
            <span class="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">1</span>
            <div class="text-sm text-gray-800 pt-0.5">
              Draw <strong class="text-blue-800">{{ fmt(result.drawFromVial) }} ml</strong> from the vial.
            </div>
          </li>

          <!-- Step 2: add diluent (only when dilution needed) -->
          <li v-if="result.needsDilution" class="flex gap-3">
            <span class="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">2</span>
            <div class="text-sm text-gray-800 pt-0.5">
              Add <strong class="text-blue-800">{{ fmt(result.diluent) }} ml</strong> of compatible diluent
              <span class="text-gray-500">(e.g. NaCl 0.9% — verify with drug reference)</span>
              into the same syringe. Mix gently.
              Total syringe volume: <strong class="text-blue-800">{{ fmt(result.totalSyringeVolume) }} ml</strong>.
            </div>
          </li>

          <!-- Final step: administer -->
          <li class="flex gap-3">
            <span
              class="flex-shrink-0 w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center"
              :class="result.needsDilution ? 'bg-blue-600' : 'bg-green-600'"
            >{{ result.needsDilution ? '3' : '2' }}</span>
            <div class="text-sm text-gray-800 pt-0.5">
              <template v-if="result.needsDilution">
                From the <strong class="text-blue-800">{{ fmt(result.totalSyringeVolume) }} ml</strong> mixture,
                administer <strong class="text-green-800">{{ fmt(result.adminVolume) }} ml</strong>.
              </template>
              <template v-else>
                Administer <strong class="text-green-800">{{ fmt(result.adminVolume) }} ml</strong>.
              </template>
            </div>
          </li>
        </ol>

        <!-- Syringe badge -->
        <div v-if="result.syringeSize" class="flex items-center gap-2 pt-1">
          <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Recommended syringe</span>
          <span class="inline-block rounded-full bg-green-100 border border-green-300 text-green-800 text-sm font-bold px-3 py-0.5">
            {{ result.syringeSize }} ml
          </span>
        </div>

        <!-- Neonatal note when diluent is very small -->
        <p
          v-if="result.needsDilution && result.rawVolume < 0.1"
          class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
        >
          Note: The drug volume (&lt; 0.1 ml) is very small. Standard 1 ml syringes may not be sufficiently
          precise in neonatal/paediatric settings. Consult a pharmacist.
        </p>
      </div>
    </Transition>

    <!-- Empty state prompt -->
    <p v-if="!inputsValid && doseValue === '' && concValue === ''" class="text-center text-sm text-gray-400">
      Enter dose and concentration above to see the protocol.
    </p>
  </div>
</template>
