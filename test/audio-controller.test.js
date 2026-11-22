import { AudioController } from '../js/audio-controller.js';
import { PitchDetector } from '../js/pitch-detector.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${message}`);
  }
}

function createMockAudioEnvironment({
  sampleRate = 48000,
  suspendOnGetUserMedia = false,
  omitFloatTimeDomain = false,
  rejectChannelCount = false
} = {}) {
  const connections = [];
  let resumeCalls = 0;
  let lastGainValue = null;
  let createdContext = null;

  class MockNode {
    constructor(name) {
      this.name = name;
      this.disconnected = false;
    }
    connect(dest) {
      connections.push([this.name, dest.name || 'destination']);
      return dest;
    }
    disconnect() {
      this.disconnected = true;
    }
  }

  class MockAudioContext {
    constructor() {
      this.sampleRate = sampleRate;
      this.state = 'suspended';
      this.currentTime = 0;
      this.destination = { name: 'destination' };
      this.onstatechange = null;
      createdContext = this;
    }
    async resume() {
      resumeCalls++;
      this.state = 'running';
    }
    createMediaStreamSource() {
      return new MockNode('source');
    }
    createBiquadFilter() {
      const node = new MockNode('filter');
      node.type = '';
      node.frequency = { setValueAtTime() {} };
      node.Q = { setValueAtTime() {} };
      return node;
    }
    createAnalyser() {
      const idx = connections.filter(([a]) => a === 'analyser').length;
      const node = new MockNode(idx === 0 ? 'analyser' : 'visualizerAnalyser');
      node.fftSize = 2048;
      Object.defineProperty(node, 'frequencyBinCount', {
        get() { return this.fftSize / 2; }
      });
      if (!omitFloatTimeDomain) {
        node.getFloatTimeDomainData = (buf) => { buf.fill(0.25); };
      }
      node.getByteTimeDomainData = (buf) => { buf.fill(192); }; // (192-128)/128 = 0.5
      node.getByteFrequencyData = (buf) => { buf.fill(100); };
      return node;
    }
    createGain() {
      const node = new MockNode('silentGain');
      node.gain = {
        value: 1,
        setValueAtTime(v) {
          this.value = v;
          lastGainValue = v;
        }
      };
      return node;
    }
  }

  let getUserMediaCalls = 0;
  const mockMediaDevices = {
    async getUserMedia(constraints) {
      getUserMediaCalls++;
      if (rejectChannelCount && constraints.audio && constraints.audio.channelCount) {
        const err = new Error('Overconstrained');
        err.name = 'OverconstrainedError';
        throw err;
      }
      if (suspendOnGetUserMedia && createdContext) {
        // Simulate iOS AVAudioSession switching / permission dialog interrupting context
        createdContext.state = 'interrupted';
      }
      return {
        getTracks() {
          return [{ stop() {} }];
        }
      };
    }
  };

  globalThis.window = { AudioContext: MockAudioContext };
  Object.defineProperty(globalThis, 'navigator', {
    value: { mediaDevices: mockMediaDevices },
    configurable: true
  });

  return {
    connections,
    getResumeCalls: () => resumeCalls,
    getLastGainValue: () => lastGainValue,
    getContext: () => createdContext,
    getGetUserMediaCalls: () => getUserMediaCalls
  };
}

async function runTests() {
  console.log('--- Testing AudioController iOS / WebKit Compatibility ---');

  // Test 1: Silent gain connected to destination + resume after iOS interruption during getUserMedia
  {
    const env = createMockAudioEnvironment({ sampleRate: 48000, suspendOnGetUserMedia: true });
    const ctrl = new AudioController();
    await ctrl.startListening();

    assert(env.getContext().state === 'running', 'AudioContext is resumed after iOS interruption during getUserMedia');
    assert(env.getResumeCalls() >= 2, `AudioContext.resume() called before and after getUserMedia (got ${env.getResumeCalls()})`);
    assert(env.getLastGainValue() === 0, 'Silent GainNode gain is set to 0 to prevent mic feedback');
    assert(
      env.connections.some(([from, to]) => from === 'silentGain' && to === 'destination'),
      'Silent GainNode connects to AudioContext.destination so WebKit pulls audio frames'
    );
    assert(
      env.connections.some(([from, to]) => from === 'analyser' && to === 'silentGain'),
      'Pitch AnalyserNode connects to silentGain sink'
    );
    assert(ctrl.analyserNode.fftSize === 2048, 'fftSize is 2048 at 48000 Hz');

    // Simulate iOS statechange to interrupted while listening
    env.getContext().state = 'interrupted';
    env.getContext().onstatechange();
    await Promise.resolve();
    assert(env.getContext().state === 'running', 'onstatechange auto-resumes AudioContext from interrupted state');

    ctrl.stopListening();
    assert(ctrl.silentGainNode === null && ctrl.isListening === false, 'stopListening cleans up nodes');
  }

  // Test 2: High sample rate (96 kHz) scales fftSize to 4096
  {
    createMockAudioEnvironment({ sampleRate: 96000 });
    const ctrl = new AudioController();
    await ctrl.startListening();
    assert(ctrl.analyserNode.fftSize === 4096, 'fftSize scales to 4096 when sampleRate > 48000 Hz');
    ctrl.stopListening();
  }

  // Test 3: OverconstrainedError fallback
  {
    const env = createMockAudioEnvironment({ rejectChannelCount: true });
    const ctrl = new AudioController();
    await ctrl.startListening();
    assert(env.getGetUserMediaCalls() === 2, 'Falls back to simpler audio constraints on OverconstrainedError');
    assert(ctrl.isListening === true, 'Listening succeeds after constraint fallback');
    ctrl.stopListening();
  }

  // Test 4: getByteTimeDomainData fallback when getFloatTimeDomainData is unavailable
  {
    createMockAudioEnvironment({ omitFloatTimeDomain: true });
    const ctrl = new AudioController();
    await ctrl.startListening();
    const data = ctrl.getAudioData();
    assert(data instanceof Float32Array && Math.abs(data[0] - 0.5) < 1e-6, 'Falls back cleanly to getByteTimeDomainData');
    ctrl.stopListening();
  }

  // Test 5: PitchDetector accuracy at iOS 48000 Hz with 2048-sample buffer
  {
    const detector = new PitchDetector(48000);
    detector.setSensitivity(0.01);
    const e2 = 82.41;
    const buf = new Float32Array(2048);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = 0.5 * Math.sin(2 * Math.PI * e2 * (i / 48000));
    }
    const res = detector.detectPitch(buf);
    const diffCents = Math.abs(1200 * Math.log2(res.frequency / e2));
    assert(res.frequency > 0 && diffCents < 2.0, `Detects E2 (82.41 Hz) at 48kHz/2048 buffer (got ${res.frequency.toFixed(2)} Hz)`);
  }

  console.log('\nAll AudioController iOS compatibility tests passed!');
}

runTests();
