/**
 * Inactivity Monitor
 * Automatically triggers a callback if no activity is recorded within a configured duration.
 * Uses wall-clock timestamps (Date.now) combined with setTimeout so it works reliably across
 * background tabs and iOS device sleep where requestAnimationFrame or timers may be paused.
 */

export const DEFAULT_AUTO_OFF_MS = 120000; // 2 minutes
export const ALLOWED_AUTO_OFF_MS = [0, 60000, 120000, 300000, 600000];

export class InactivityMonitor {
  constructor({
    timeoutMs = DEFAULT_AUTO_OFF_MS,
    onTimeout = () => {},
    now = () => Date.now(),
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id)
  } = {}) {
    this.timeoutMs = Math.max(0, Number(timeoutMs) || 0);
    this.onTimeout = onTimeout;
    this._now = now;
    this._setTimer = setTimer;
    this._clearTimer = clearTimer;

    this.isRunning = false;
    this.lastActivityAt = 0;
    this.timerId = null;
    this._lastScheduledAt = 0;
  }

  start() {
    this.isRunning = true;
    this.lastActivityAt = this._now();
    this._schedule(this.timeoutMs);
  }

  stop() {
    this.isRunning = false;
    this._clearPendingTimer();
  }

  recordActivity() {
    if (!this.isRunning) return;
    const now = this._now();
    this.lastActivityAt = now;

    // Avoid churning setTimeout at 60fps; reschedule at most once per second.
    // Even if not rescheduled immediately, _handleTimer checks elapsed wall-clock time.
    if (this.timeoutMs > 0 && now - this._lastScheduledAt >= 1000) {
      this._schedule(this.timeoutMs);
    }
  }

  setTimeoutMs(ms) {
    this.timeoutMs = Math.max(0, Number(ms) || 0);
    if (!this.isRunning) return;

    if (this.timeoutMs === 0) {
      this._clearPendingTimer();
      return;
    }

    const elapsed = this._now() - this.lastActivityAt;
    const remaining = this.timeoutMs - elapsed;
    if (remaining <= 0) {
      this._triggerTimeout();
    } else {
      this._schedule(remaining);
    }
  }

  /**
   * Explicitly verify elapsed wall-clock time (e.g. on visibilitychange after iOS sleep).
   * Returns true if the timeout expired and triggered.
   */
  checkNow() {
    if (!this.isRunning || this.timeoutMs <= 0) return false;
    const elapsed = this._now() - this.lastActivityAt;
    if (elapsed >= this.timeoutMs) {
      this._triggerTimeout();
      return true;
    }
    // Reschedule for the remaining duration in case OS throttled the previous timer
    this._schedule(this.timeoutMs - elapsed);
    return false;
  }

  _schedule(delayMs) {
    this._clearPendingTimer();
    if (!this.isRunning || this.timeoutMs <= 0) return;

    const safeDelay = Math.max(1, delayMs);
    this._lastScheduledAt = this._now();
    this.timerId = this._setTimer(() => this._handleTimer(), safeDelay);
  }

  _clearPendingTimer() {
    if (this.timerId !== null) {
      this._clearTimer(this.timerId);
      this.timerId = null;
    }
  }

  _handleTimer() {
    this.timerId = null;
    if (!this.isRunning || this.timeoutMs <= 0) return;

    const elapsed = this._now() - this.lastActivityAt;
    const remaining = this.timeoutMs - elapsed;
    if (remaining <= 0) {
      this._triggerTimeout();
    } else {
      this._schedule(remaining);
    }
  }

  _triggerTimeout() {
    this.stop();
    this.onTimeout();
  }
}
