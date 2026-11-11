import { 
  loadCustomTunings, 
  saveCustomTuning, 
  deleteCustomTuning, 
  getAllTunings, 
  TUNING_PRESETS 
} from '../js/tunings.js';

// Polyfill minimal localStorage for testing
const mockStorage = {};
globalThis.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = val.toString(); },
  removeItem: (key) => { delete mockStorage[key]; }
};

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${message}`);
  }
}

console.log('--- Testing Custom Tunings Persistence ---');

// 1. Initial state
assert(loadCustomTunings().length === 0, 'Initial custom tunings list is empty');
assert(getAllTunings().length === TUNING_PRESETS.length, 'getAllTunings returns built-in presets when no custom tunings exist');

// 2. Save a custom tuning
const openC = {
  id: 'custom_123',
  category: '⭐ Custom Tunings',
  name: 'Open C (C G C G C E)',
  isCustom: true,
  strings: [
    { num: 6, note: 'C', octave: 2, name: 'C2' },
    { num: 5, note: 'G', octave: 2, name: 'G2' },
    { num: 4, note: 'C', octave: 3, name: 'C3' },
    { num: 3, note: 'G', octave: 3, name: 'G3' },
    { num: 2, note: 'C', octave: 4, name: 'C4' },
    { num: 1, note: 'E', octave: 4, name: 'E4' },
  ]
};

const saved = saveCustomTuning(openC);
assert(saved === true, 'Successfully saved Open C custom tuning');

const loaded = loadCustomTunings();
assert(loaded.length === 1, 'loadCustomTunings returns 1 custom tuning');
assert(loaded[0].name === 'Open C (C G C G C E)', 'Custom tuning name preserved');
assert(loaded[0].strings.length === 6, 'Custom tuning has 6 strings');

// 3. getAllTunings should now have custom tuning first
const all = getAllTunings();
assert(all.length === TUNING_PRESETS.length + 1, 'getAllTunings returns presets + custom tuning');
assert(all[0].id === 'custom_123', 'Custom tuning appears at top of list');

// 4. Delete custom tuning
const deleted = deleteCustomTuning('custom_123');
assert(deleted === true, 'Successfully deleted custom tuning');
assert(loadCustomTunings().length === 0, 'Custom tunings list is empty after deletion');
assert(getAllTunings().length === TUNING_PRESETS.length, 'getAllTunings back to original preset count');

console.log('\nAll custom tuning tests passed successfully!');
