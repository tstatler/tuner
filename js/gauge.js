/**
 * High-DPI Canvas Tuning Gauge
 * Renders an arc meter with calibrated cent ticks, smoothed needle damping, and dynamic glow states.
 */

export class TunerGauge {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.targetCents = 0;
    this.currentCents = 0;
    this.isActive = false;
    this.isInTune = false;
    this.tolerance = 3; // within +/- 3 cents is considered "In Tune"

    this.dpr = window.devicePixelRatio || 1;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width || 360;
    this.height = rect.height || 220;
    this.dpr = window.devicePixelRatio || 1;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    this.render();
  }

  setCents(cents, active = true) {
    this.isActive = active;
    if (!active) {
      this.targetCents = 0;
      this.isInTune = false;
    } else {
      // Clamp between -50 and 50
      this.targetCents = Math.max(-50, Math.min(50, cents));
      this.isInTune = Math.abs(cents) <= this.tolerance;
    }
  }

  update() {
    if (!this.isActive) {
      // Slowly relax needle to center if inactive
      this.currentCents += (0 - this.currentCents) * 0.1;
    } else {
      // Smooth physical damping
      this.currentCents += (this.targetCents - this.currentCents) * 0.22;
    }
    this.render();
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h * 0.88;
    const radius = Math.min(w * 0.44, h * 0.76);

    const startAngle = Math.PI * 0.8;
    const endAngle = Math.PI * 0.2;
    // Total sweep angle
    const totalAngle = Math.PI * 1.4;

    // Helper: convert cents (-50 to +50) to radian angle
    const centsToAngle = (cents) => {
      const normalized = (cents + 50) / 100; // 0 to 1
      return startAngle + normalized * totalAngle;
    };

    // 1. Draw Background Track Arc
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + totalAngle, false);
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    // 2. Draw In-Tune Center Zone on Track
    const inTuneAngleLeft = centsToAngle(-this.tolerance);
    const inTuneAngleRight = centsToAngle(this.tolerance);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, inTuneAngleLeft, inTuneAngleRight, false);
    ctx.lineWidth = 14;
    ctx.strokeStyle = this.isInTune ? 'rgba(52, 211, 153, 0.85)' : 'rgba(52, 211, 153, 0.25)';
    ctx.stroke();
    ctx.restore();

    // 3. Draw Cents Tick Marks & Labels
    for (let c = -50; c <= 50; c += 5) {
      const angle = centsToAngle(c);
      const isMajor = c % 10 === 0;
      const isCenter = c === 0;

      const innerDist = isMajor ? radius - 18 : radius - 10;
      const outerDist = radius + 12;

      const x1 = centerX + Math.cos(angle) * innerDist;
      const y1 = centerY + Math.sin(angle) * innerDist;
      const x2 = centerX + Math.cos(angle) * outerDist;
      const y2 = centerY + Math.sin(angle) * outerDist;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);

      if (isCenter) {
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = this.isInTune ? '#10b981' : '#34d399';
        if (this.isInTune) {
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 10;
        }
      } else if (isMajor) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      } else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      }
      ctx.stroke();
      ctx.restore();

      // Major tick labels
      if (isMajor && (c % 20 === 0 || c === 0)) {
        const textDist = radius - 30;
        const tx = centerX + Math.cos(angle) * textDist;
        const ty = centerY + Math.sin(angle) * textDist;

        ctx.save();
        ctx.font = '600 11px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (isCenter) {
          ctx.fillStyle = this.isInTune ? '#34d399' : 'rgba(255, 255, 255, 0.7)';
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        }
        const label = c > 0 ? `+${c}` : `${c}`;
        ctx.fillText(label, tx, ty);
        ctx.restore();
      }
    }

    // 4. Draw Needle
    const needleAngle = centsToAngle(this.currentCents);
    const needleLen = radius + 8;
    const nx = centerX + Math.cos(needleAngle) * needleLen;
    const ny = centerY + Math.sin(needleAngle) * needleLen;

    ctx.save();
    let needleColor = '#94a3b8'; // idle default
    if (this.isActive) {
      if (this.isInTune) {
        needleColor = '#10b981'; // Green
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 14;
      } else if (Math.abs(this.currentCents) <= 10) {
        needleColor = '#38bdf8'; // Cyan when getting close
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;
      } else if (this.currentCents < 0) {
        needleColor = '#f59e0b'; // Amber for flat
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
      } else {
        needleColor = '#ef4444'; // Red/Coral for sharp
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8;
      }
    }

    // Needle line with gradient / tapering
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(nx, ny);
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = needleColor;
    ctx.stroke();

    // Center pivot cap
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fillStyle = needleColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.restore();
  }
}
