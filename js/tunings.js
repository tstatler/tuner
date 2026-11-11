/**
 * Guitar and Instrument Tunings & Pitch Mathematics
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const TUNING_PRESETS = [
  {
    id: 'standard',
    category: 'Guitar (6-String)',
    name: 'Standard (E A D G B E)',
    strings: [
      { num: 6, note: 'E', octave: 2, name: 'E2' },
      { num: 5, note: 'A', octave: 2, name: 'A2' },
      { num: 4, note: 'D', octave: 3, name: 'D3' },
      { num: 3, note: 'G', octave: 3, name: 'G3' },
      { num: 2, note: 'B', octave: 3, name: 'B3' },
      { num: 1, note: 'E', octave: 4, name: 'E4' },
    ]
  },
  {
    id: 'drop_d',
    category: 'Guitar (6-String)',
    name: 'Drop D (D A D G B E)',
    strings: [
      { num: 6, note: 'D', octave: 2, name: 'D2' },
      { num: 5, note: 'A', octave: 2, name: 'A2' },
      { num: 4, note: 'D', octave: 3, name: 'D3' },
      { num: 3, note: 'G', octave: 3, name: 'G3' },
      { num: 2, note: 'B', octave: 3, name: 'B3' },
      { num: 1, note: 'E', octave: 4, name: 'E4' },
    ]
  },
  {
    id: 'dadgad',
    category: 'Guitar (6-String)',
    name: 'DADGAD (Celtic / Folk)',
    strings: [
      { num: 6, note: 'D', octave: 2, name: 'D2' },
      { num: 5, note: 'A', octave: 2, name: 'A2' },
      { num: 4, note: 'D', octave: 3, name: 'D3' },
      { num: 3, note: 'G', octave: 3, name: 'G3' },
      { num: 2, note: 'A', octave: 3, name: 'A3' },
      { num: 1, note: 'D', octave: 4, name: 'D4' },
    ]
  },
  {
    id: 'open_d',
    category: 'Guitar (6-String)',
    name: 'Open D (D A D F# A D)',
    strings: [
      { num: 6, note: 'D', octave: 2, name: 'D2' },
      { num: 5, note: 'A', octave: 2, name: 'A2' },
      { num: 4, note: 'D', octave: 3, name: 'D3' },
      { num: 3, note: 'F#', octave: 3, name: 'F#3' },
      { num: 2, note: 'A', octave: 3, name: 'A3' },
      { num: 1, note: 'D', octave: 4, name: 'D4' },
    ]
  },
  {
    id: 'open_g',
    category: 'Guitar (6-String)',
    name: 'Open G (D G D G B D)',
    strings: [
      { num: 6, note: 'D', octave: 2, name: 'D2' },
      { num: 5, note: 'G', octave: 2, name: 'G2' },
      { num: 4, note: 'D', octave: 3, name: 'D3' },
      { num: 3, note: 'G', octave: 3, name: 'G3' },
      { num: 2, note: 'B', octave: 3, name: 'B3' },
      { num: 1, note: 'D', octave: 4, name: 'D4' },
    ]
  },
  {
    id: 'half_step_down',
    category: 'Guitar (6-String)',
    name: 'Half-Step Down (Eb Ab Db Gb Bb Eb)',
    strings: [
      { num: 6, note: 'D#', octave: 2, name: 'Eb2' },
      { num: 5, note: 'G#', octave: 2, name: 'Ab2' },
      { num: 4, note: 'C#', octave: 3, name: 'Db3' },
      { num: 3, note: 'F#', octave: 3, name: 'Gb3' },
      { num: 2, note: 'A#', octave: 3, name: 'Bb3' },
      { num: 1, note: 'D#', octave: 4, name: 'Eb4' },
    ]
  },
  {
    id: 'full_step_down',
    category: 'Guitar (6-String)',
    name: 'Full-Step Down (D G C F A D)',
    strings: [
      { num: 6, note: 'D', octave: 2, name: 'D2' },
      { num: 5, note: 'G', octave: 2, name: 'G2' },
      { num: 4, note: 'C', octave: 3, name: 'C3' },
      { num: 3, note: 'F', octave: 3, name: 'F3' },
      { num: 2, note: 'A', octave: 3, name: 'A3' },
      { num: 1, note: 'D', octave: 4, name: 'D4' },
    ]
  },
  {
    id: 'drop_c',
    category: 'Guitar (6-String)',
    name: 'Drop C (C G C F A D)',
    strings: [
      { num: 6, note: 'C', octave: 2, name: 'C2' },
      { num: 5, note: 'G', octave: 2, name: 'G2' },
      { num: 4, note: 'C', octave: 3, name: 'C3' },
      { num: 3, note: 'F', octave: 3, name: 'F3' },
      { num: 2, note: 'A', octave: 3, name: 'A3' },
      { num: 1, note: 'D', octave: 4, name: 'D4' },
    ]
  },
  {
    id: 'open_e',
    category: 'Guitar (6-String)',
    name: 'Open E (E B E G# B E)',
    strings: [
      { num: 6, note: 'E', octave: 2, name: 'E2' },
      { num: 5, note: 'B', octave: 2, name: 'B2' },
      { num: 4, note: 'E', octave: 3, name: 'E3' },
      { num: 3, note: 'G#', octave: 3, name: 'G#3' },
      { num: 2, note: 'B', octave: 3, name: 'B3' },
      { num: 1, note: 'E', octave: 4, name: 'E4' },
    ]
  },
  {
    id: 'guitar_7_string',
    category: 'Extended Range',
    name: '7-String Standard (B E A D G B E)',
    strings: [
      { num: 7, note: 'B', octave: 1, name: 'B1' },
      { num: 6, note: 'E', octave: 2, name: 'E2' },
      { num: 5, note: 'A', octave: 2, name: 'A2' },
      { num: 4, note: 'D', octave: 3, name: 'D3' },
      { num: 3, note: 'G', octave: 3, name: 'G3' },
      { num: 2, note: 'B', octave: 3, name: 'B3' },
      { num: 1, note: 'E', octave: 4, name: 'E4' },
    ]
  },
  {
    id: 'bass_4',
    category: 'Bass Guitar',
    name: 'Bass 4-String Standard (E A D G)',
    strings: [
      { num: 4, note: 'E', octave: 1, name: 'E1' },
      { num: 3, note: 'A', octave: 1, name: 'A1' },
      { num: 2, note: 'D', octave: 2, name: 'D2' },
      { num: 1, note: 'G', octave: 2, name: 'G2' },
    ]
  },
  {
    id: 'bass_5',
    category: 'Bass Guitar',
    name: 'Bass 5-String Standard (B E A D G)',
    strings: [
      { num: 5, note: 'B', octave: 0, name: 'B0' },
      { num: 4, note: 'E', octave: 1, name: 'E1' },
      { num: 3, note: 'A', octave: 1, name: 'A1' },
      { num: 2, note: 'D', octave: 2, name: 'D2' },
      { num: 1, note: 'G', octave: 2, name: 'G2' },
    ]
  },
  {
    id: 'ukulele',
    category: 'Ukulele',
    name: 'Ukulele Standard (G C E A)',
    strings: [
      { num: 4, note: 'G', octave: 4, name: 'G4' },
      { num: 3, note: 'C', octave: 4, name: 'C4' },
      { num: 2, note: 'E', octave: 4, name: 'E4' },
      { num: 1, note: 'A', octave: 4, name: 'A4' },
    ]
  }
];

/**
 * Custom Tunings LocalStorage Persistence
 */
const STORAGE_KEY = 'guitar_tuner_custom_tunings';

export function loadCustomTunings() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error loading custom tunings:', e);
    return [];
  }
}

export function saveCustomTuning(tuning) {
  if (typeof localStorage === 'undefined') return false;
  try {
    const existing = loadCustomTunings();
    const index = existing.findIndex(t => t.id === tuning.id);
    if (index >= 0) {
      existing[index] = tuning;
    } else {
      existing.unshift(tuning);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    return true;
  } catch (e) {
    console.error('Error saving custom tuning:', e);
    return false;
  }
}

export function deleteCustomTuning(tuningId) {
  if (typeof localStorage === 'undefined') return false;
  try {
    const existing = loadCustomTunings();
    const filtered = existing.filter(t => t.id !== tuningId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (e) {
    console.error('Error deleting custom tuning:', e);
    return false;
  }
}

export function getAllTunings() {
  const custom = loadCustomTunings();
  return [...custom, ...TUNING_PRESETS];
}

/**
 * Returns MIDI note number for note name and octave (e.g. 'A', 4 -> 69)
 */
export function getMidiNumber(noteName, octave) {
  const normName = noteName.replace('b', '#');
  const flatToSharpMap = {
    'Db': 'C#',
    'Eb': 'D#',
    'Gb': 'F#',
    'Ab': 'G#',
    'Bb': 'A#'
  };
  const key = flatToSharpMap[normName] || normName;
  const noteIndex = NOTE_NAMES.indexOf(key);
  if (noteIndex === -1) return 69;
  return (octave + 1) * 12 + noteIndex;
}

/**
 * Calculates frequency for given note name and octave with customizable A4 reference
 */
export function getFrequency(noteName, octave, a4Freq = 440) {
  const midi = getMidiNumber(noteName, octave);
  return a4Freq * Math.pow(2, (midi - 69) / 12);
}

/**
 * Calculates frequency for a MIDI number
 */
export function midiToFrequency(midi, a4Freq = 440) {
  return a4Freq * Math.pow(2, (midi - 69) / 12);
}

/**
 * Converts frequency in Hz to closest musical note, target frequency, and cents offset (-50 to +50)
 */
export function frequencyToNote(frequency, a4Freq = 440) {
  if (!frequency || frequency <= 0) return null;

  // A4 = 440 Hz -> MIDI 69
  const midiExact = 69 + 12 * Math.log2(frequency / a4Freq);
  const midiRounded = Math.round(midiExact);
  const cents = Math.round((midiExact - midiRounded) * 100);

  const noteIndex = ((midiRounded % 12) + 12) % 12;
  const octave = Math.floor(midiRounded / 12) - 1;
  const noteName = NOTE_NAMES[noteIndex];
  const targetFrequency = midiToFrequency(midiRounded, a4Freq);

  return {
    frequency,
    targetFrequency,
    diffHz: frequency - targetFrequency,
    cents, // -50 to +50
    note: noteName,
    octave,
    midi: midiRounded,
    displayName: `${noteName}${octave}`
  };
}

/**
 * Calculates cents offset between two frequencies
 */
export function calculateCents(actualFreq, targetFreq) {
  if (!actualFreq || !targetFreq || actualFreq <= 0 || targetFreq <= 0) return 0;
  return 1200 * Math.log2(actualFreq / targetFreq);
}

/**
 * Finds closest string in a given tuning configuration for a detected frequency
 */
export function findClosestString(frequency, strings, a4Freq = 440) {
  if (!frequency || !strings || strings.length === 0) return null;

  let closestString = null;
  let minAbsCents = Infinity;

  for (const str of strings) {
    const targetFreq = getFrequency(str.note, str.octave, a4Freq);
    const cents = calculateCents(frequency, targetFreq);
    const absCents = Math.abs(cents);

    if (absCents < minAbsCents) {
      minAbsCents = absCents;
      closestString = {
        ...str,
        targetFrequency: targetFreq,
        cents: Math.round(cents),
        absCents
      };
    }
  }

  return closestString;
}
