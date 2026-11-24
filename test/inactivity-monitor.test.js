import { InactivityMonitor } from '../js/inactivity-monitor.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${message}`);
  }
}

function createFakeClock() {
  let currentTime = 1000;
  let nextId = 1;
  const timers = new Map();

  return {
    now: () => currentTime,
    setTimer: (fn, delayMs) => {
      const id = nextId++;
      timers.set(id, { fn, runAt: currentTime + delayMs });
      return id;
    },
    clearTimer: (id) => {
      timers.delete(id);
    },
    advanceBy: (ms) => {
      const target = currentTime + ms;
      while (true) {
        let earliest = null;
        for (const [id, t] of timers.entries()) {
          if (t.runAt <= target && (!earliest || t.runAt < earliest.runAt)) {
            earliest = { id, ...t };
          }
        }
        if (!earliest) break;
        timers.delete(earliest.id);
        currentTime = earliest.runAt;
        earliest.fn();
      }
      currentTime = target;
    },
    jumpClockOnly: (ms) => {
      // Simulates OS/iOS sleep where wall clock advances but timers did not fire
      currentTime += ms;
    },
    pendingCount: () => timers.size
  };
}

function runTests() {
  console.log('--- Testing InactivityMonitor ---');

  // 1. Fires onTimeout after timeoutMs with no activity
  {
    const clock = createFakeClock();
    let timedOut = 0;
    const monitor = new InactivityMonitor({
      timeoutMs: 120000,
      onTimeout: () => { timedOut++; },
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer
    });

    monitor.start();
    clock.advanceBy(119999);
    assert(timedOut === 0, 'Does not time out before timeoutMs elapses');
    clock.advanceBy(1);
    assert(timedOut === 1, 'Fires onTimeout exactly when timeoutMs elapses');
    assert(monitor.isRunning === false, 'Monitor stops running after firing onTimeout');
  }

  // 2. recordActivity resets countdown
  {
    const clock = createFakeClock();
    let timedOut = 0;
    const monitor = new InactivityMonitor({
      timeoutMs: 120000,
      onTimeout: () => { timedOut++; },
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer
    });

    monitor.start();
    clock.advanceBy(100000);
    monitor.recordActivity();
    clock.advanceBy(100000);
    assert(timedOut === 0, 'recordActivity extends deadline past original timeout');
    clock.advanceBy(20000);
    assert(timedOut === 1, 'Fires timeout 120s after last recorded activity');
  }

  // 3. stop() cancels pending timer
  {
    const clock = createFakeClock();
    let timedOut = 0;
    const monitor = new InactivityMonitor({
      timeoutMs: 60000,
      onTimeout: () => { timedOut++; },
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer
    });

    monitor.start();
    clock.advanceBy(30000);
    monitor.stop();
    clock.advanceBy(120000);
    assert(timedOut === 0 && clock.pendingCount() === 0, 'stop() cancels pending timer and prevents timeout');
  }

  // 4. setTimeoutMs(0) disables auto-off; shortening while running reschedules / triggers immediately
  {
    const clock = createFakeClock();
    let timedOut = 0;
    const monitor = new InactivityMonitor({
      timeoutMs: 120000,
      onTimeout: () => { timedOut++; },
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer
    });

    monitor.start();
    monitor.setTimeoutMs(0);
    clock.advanceBy(600000);
    assert(timedOut === 0 && clock.pendingCount() === 0, 'setTimeoutMs(0) disables auto-off');

    // Re-enable with shorter timeout than already elapsed -> triggers immediately
    monitor.setTimeoutMs(60000);
    assert(timedOut === 1, 'Shortening timeout below already-elapsed time triggers immediately');
  }

  // 5. checkNow() catches wall-clock expiration after simulated iOS device sleep
  {
    const clock = createFakeClock();
    let timedOut = 0;
    const monitor = new InactivityMonitor({
      timeoutMs: 120000,
      onTimeout: () => { timedOut++; },
      now: clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer
    });

    monitor.start();
    clock.jumpClockOnly(180000); // 3 minutes passed while phone was locked
    const expired = monitor.checkNow();
    assert(expired === true && timedOut === 1, 'checkNow() detects wall-clock expiration after device sleep');
  }

  console.log('\nAll InactivityMonitor tests passed!');
}

runTests();
