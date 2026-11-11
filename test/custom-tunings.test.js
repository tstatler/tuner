import { 
  loadCustomTunings, 
  saveCustomTuning, 
  deleteCustomTuning, 
  getAllTunings, 
  TUNING_PRESETS,
  parseTuningString
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

console.log('\n--- Testing Pasted Tuning String Interpretation ---');

// Test 1: Continuous 6-letter string "DADGAD"
const parsed1 = parseTuningString('DADGAD');
assert(parsed1 !== null && parsed1.length === 6, 'Parsed 6 strings from DADGAD');
assert(parsed1.map(s => s.name).join(' ') === 'D2 A2 D3 G3 A3 D4', 'DADGAD accurately interpreted low to high (D2 A2 D3 G3 A3 D4)');

// Test 2: Space separated "D A D G B E"
const parsed2 = parseTuningString('D A D G B E');
assert(parsed2 !== null && parsed2.length === 6, 'Parsed 6 strings from D A D G B E');
assert(parsed2.map(s => s.name).join(' ') === 'D2 A2 D3 G3 B3 E4', 'D A D G B E accurately interpreted as Drop D');

// Test 3: Hyphen-separated with sharps "D-A-D-F#-A-D"
const parsed3 = parseTuningString('D-A-D-F#-A-D');
assert(parsed3 !== null && parsed3.length === 6, 'Parsed 6 strings from D-A-D-F#-A-D');
assert(parsed3.map(s => s.name).join(' ') === 'D2 A2 D3 F#3 A3 D4', 'D-A-D-F#-A-D accurately interpreted as Open D');

// Test 4: Flats "Eb Ab Db Gb Bb Eb"
const parsed4 = parseTuningString('Eb Ab Db Gb Bb Eb');
assert(parsed4 !== null && parsed4.length === 6, 'Parsed 6 strings from flats');
assert(parsed4.map(s => s.name).join(' ') === 'Eb2 Ab2 Db3 Gb3 Bb3 Eb4', 'Flats accurately converted and pitched');

// Test 5: Lowercase with prefix "Tuning: c g c f a d"
const parsed5 = parseTuningString('Tuning: c g c f a d');
assert(parsed5 !== null && parsed5.length === 6, 'Parsed 6 strings from prefixed lowercase string');
assert(parsed5.map(s => s.name).join(' ') === 'C2 G2 C3 F3 A3 D4', 'Prefixed lowercase string accurately interpreted as Drop C');

// Test 6: Explicit octaves "D2 A2 D3 G3 B3 E4"
const parsed6 = parseTuningString('D2 A2 D3 G3 B3 E4');
assert(parsed6 !== null && parsed6.map(s => s.name).join(' ') === 'D2 A2 D3 G3 B3 E4', 'Explicit octaves correctly preserved');

console.log('\nAll custom tuning tests passed successfully!');
