// Cyber Particle — HUD display manager
import { getGesture, getConfidence } from './gesture.js';

const gestureNames = {
  open: 'NEBULA',
  fist: 'SPHERE',
  pinch: 'SPIRAL',
  point: 'BEAM',
};

let fpsFrames = 0;
let fpsTime = performance.now();
let fpsDisplay = 0;

export class HudManager {
  static update() {
    fpsFrames++;
    const now = performance.now();
    if (now - fpsTime >= 500) {
      fpsDisplay = Math.round(fpsFrames / ((now - fpsTime) / 1000));
      fpsFrames = 0;
      fpsTime = now;
    }

    document.getElementById('fps-display').textContent = `FPS: ${fpsDisplay}`;

    const gesture = getGesture();
    const nameEl = document.getElementById('gesture-name');
    nameEl.innerHTML = `${gestureNames[gesture] || '--'}<span class="cursor">_</span>`;

    const conf = getConfidence();
    document.getElementById('confidence-display').textContent =
      `CONF: ${(conf * 100).toFixed(0)}%`;

    document.querySelectorAll('.bar-segment').forEach(seg => {
      seg.classList.toggle('active', seg.dataset.gesture === gesture);
    });
  }
}

function hudLoop() {
  HudManager.update();
  requestAnimationFrame(hudLoop);
}
requestAnimationFrame(hudLoop);
