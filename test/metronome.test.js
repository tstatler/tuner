import { Metronome, MIN_BPM, MAX_BPM } from '../js/metronome.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${message}`);
  }
}

function createMockAudioController() {
  const scheduledOscs = [];
  const ctx = {
    currentTime: 0,
    destination: { name: 'destination' },
    createGain() {
      return {
        connect() {},
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {}
        }
      };
    },
    createOscillator() {
      const osc = {
        type: 'sine',
        freq: 0,
        startedAt: null,
        stoppedAt: null,
        connect() {},
        frequency: {
          setValueAtTime(v) { osc.freq = v; },
          exponentialRampToValueAtTime() {}
        },
        start(t) { osc.startedAt = t; scheduledOscs.push(osc); },
        stop(t) { osc.stoppedAt = t; }
      };
      return osc;
    }
  };

  return {
    audioContext: ctx,
    scheduledOscs,
    async initAudioContext() {
      return ctx;
    }
  };
}

async function runTests() {
  console.log('--- Testing Metronome ---');

  // 1. BPM clamping & time signatures
  {
    const ac = createMockAudioController();
    const m = new Metronome(ac);
    assert(m.setBpm(10) === MIN_BPM, `Clamps low BPM to ${MIN_BPM}`);
    assert(m.setBpm(500) === MAX_BPM, `Clamps high BPM to ${MAX_BPM}`);
    assert(m.setBpm(118.6) === 119, 'Rounds fractional BPM');

    m.setTimeSignature('6/8');
    assert(m.beatsPerMeasure === 6, '6/8 sets 6 beats per measure');
    m.setTimeSignature('3/4');
    assert(m.beatsPerMeasure === 3, '3/4 sets 3 beats per measure');
    m.setTimeSignature('invalid');
    assert(m.timeSignature === '3/4', 'Ignores invalid time signature');
  }

  // 2. Tap Tempo
  {
    const ac = createMockAudioController();
    const m = new Metronome(ac);
    assert(m.recordTap(1000) === null, 'First tap returns null');
    assert(m.recordTap(1500) === 120, '500ms interval computes 120 BPM');
    assert(m.recordTap(2000) === 120, 'Consistent 500ms taps stay at 120 BPM');
    // Reset after > 2.5s pause
    assert(m.recordTap(6000) === null, 'Pause > 2.5s resets tap history');
    assert(m.recordTap(6600) === 100, '600ms interval after reset computes 100 BPM');
  }

  // 3. Lookahead scheduler timing, beat wrapping, accenting, and drift guard
  {
    const ac = createMockAudioController();
    let intervalFn = null;
    let clearedInterval = false;
    const beatEvents = [];

    const m = new Metronome(ac, {
      bpm: 120, // 0.5s per beat
      timeSignature: '3/4',
      onBeat: (beat, isAccent) => beatEvents.push({ beat, isAccent }),
      setIntervalFn: (fn) => { intervalFn = fn; return 42; },
      clearIntervalFn: () => { clearedInterval = true; },
      setTimeoutFn: (fn) => { fn(); return 1; },
      clearTimeoutFn: () => {}
    });

    await m.start();
    // At t=0, nextNoteTime starts at 0.05 (< 0 + 0.1), so beat 0 is scheduled at 0.05
    assert(ac.scheduledOscs.length === 1, 'Schedules beat 0 immediately on start');
    assert(Math.abs(ac.scheduledOscs[0].startedAt - 0.05) < 1e-6, 'Beat 0 scheduled at t=0.05s');
    assert(beatEvents[0].beat === 0 && beatEvents[0].isAccent === true, 'Beat 0 is accented');

    // Advance AudioContext time to 0.50 -> nextNoteTime (0.55) < 0.60 -> beat 1 scheduled
    ac.audioContext.currentTime = 0.50;
    intervalFn();
    assert(ac.scheduledOscs.length === 2, 'Schedules beat 1 at t=0.55s');
    assert(Math.abs(ac.scheduledOscs[1].startedAt - 0.55) < 1e-6, 'Beat 1 timestamp is exact (0.55s)');
    assert(beatEvents[1].beat === 1 && beatEvents[1].isAccent === false, 'Beat 1 is not accented');

    // Advance to 1.00 -> beat 2 scheduled at 1.05
    ac.audioContext.currentTime = 1.00;
    intervalFn();
    assert(beatEvents[2].beat === 2 && beatEvents[2].isAccent === false, 'Beat 2 is not accented');

    // Advance to 1.50 -> wraps back to beat 0 (accented)
    ac.audioContext.currentTime = 1.50;
    intervalFn();
    assert(beatEvents[3].beat === 0 && beatEvents[3].isAccent === true, 'Wraps back to accented beat 0 after 3/4 measure');

    // Drift guard: jump currentTime forward by 10 seconds (simulated iOS backgrounding)
    ac.audioContext.currentTime = 11.50;
    const countBefore = ac.scheduledOscs.length;
    intervalFn();
    assert(
      ac.scheduledOscs.length === countBefore + 1,
      `Drift guard prevents burst of catch-up clicks (scheduled ${ac.scheduledOscs.length - countBefore} click)`
    );

    m.stop();
    assert(m.isPlaying === false && clearedInterval === true, 'stop() halts metronome and clears scheduler interval');
  }

  // 4. All click sound timbres & volume=0 silence
  {
    for (const sound of ['woodblock', 'digital', 'soft']) {
      const ac = createMockAudioController();
      const m = new Metronome(ac, {
        sound,
        volume: 0.8,
        setIntervalFn: () => 1,
        clearIntervalFn: () => {},
        setTimeoutFn: () => 1,
        clearTimeoutFn: () => {}
      });
      await m.start();
      assert(ac.scheduledOscs.length === 1, `Synthesizes '${sound}' click sound cleanly`);
      m.stop();
    }

    const acMuted = createMockAudioController();
    const muted = new Metronome(acMuted, {
      volume: 0,
      setIntervalFn: () => 1,
      clearIntervalFn: () => {},
      setTimeoutFn: () => 1,
      clearTimeoutFn: () => {}
    });
    await muted.start();
    assert(acMuted.scheduledOscs.length === 0, 'Volume 0 skips oscillator synthesis');
    muted.stop();
  }

  console.log('\nAll Metronome tests passed!');
}

runTests();
