// Cyber Particle — Gesture Detection via MediaPipe Hands
// Pattern verified against working reference projects (GestureScape, Interactive-3D-Particle-System)

const DebounceMs = 250;
const FingerTipIds = [4, 8, 12, 16, 20];
const FingerMcpIds = [1, 5, 9, 13, 17];
const MiddleMcpId = 9;

let currentGesture = 'open';
let lastSwitchTime = 0;
let handCenter = { x: 0.5, y: 0.5 };
let handConfidence = 0;
let isActive = false;

export function getGesture() { return currentGesture; }
export function getHandCenter() { return handCenter; }
export function getConfidence() { return handConfidence; }
export function isRunning() { return isActive; }

export function initGesture(videoEl) {
  return new Promise((resolve, reject) => {
    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const lm = results.multiHandLandmarks[0];
        handConfidence =
          results.multiHandedness && results.multiHandedness.length > 0
            ? results.multiHandedness[0].score
            : 0.9;
        handCenter = { x: lm[MiddleMcpId].x, y: lm[MiddleMcpId].y };
        classifyGesture(lm);
      } else {
        handConfidence = 0;
      }
    });

    navigator.mediaDevices
      .getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' } })
      .then((stream) => {
        videoEl.srcObject = stream;
        videoEl.play();
        isActive = true;
        console.log('Camera active, starting detection loop');
        resolve();
        requestAnimationFrame(tick);
      })
      .catch((err) => {
        if (err.name === 'NotAllowedError') {
          document.getElementById('permission-prompt').classList.remove('hidden');
          document.getElementById('enable-camera').onclick = () => location.reload();
          reject(err);
        } else {
          reject(err);
        }
      });

    async function tick() {
      if (!isActive) return;
      await hands.send({ image: videoEl });
      requestAnimationFrame(tick);
    }
  });
}

function classifyGesture(lm) {
  const now = performance.now();
  if (now - lastSwitchTime < DebounceMs) return;

  const fingersExtended = [];
  for (let i = 0; i < 5; i++) {
    const tip = lm[FingerTipIds[i]];
    const mcp = lm[FingerMcpIds[i]];
    const dist = Math.hypot(tip.x - mcp.x, tip.y - mcp.y);
    fingersExtended.push(dist > 0.15);
  }

  const [thumb, index, middle, ring, pinky] = fingersExtended;
  const thumbTip = lm[FingerTipIds[0]];
  const indexTip = lm[FingerTipIds[1]];
  const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

  let gesture = currentGesture;

  if (pinchDist < 0.05 && !middle && !ring && !pinky) {
    gesture = 'pinch';
  } else if (index && !middle && !ring && !pinky) {
    gesture = 'point';
  } else if (fingersExtended.every(Boolean)) {
    gesture = 'open';
  } else if (fingersExtended.every((f) => !f)) {
    gesture = 'fist';
  }

  if (gesture !== currentGesture) {
    currentGesture = gesture;
    lastSwitchTime = now;
  }
}

export function stopGesture() {
  isActive = false;
}
