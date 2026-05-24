// Cyber Particle — Gesture Detection via MediaPipe HandLandmarker
// Uses IMAGE mode to avoid VIDEO mode's IMAGE_DIMENSIONS issues

const DebounceMs = 250;
const FingerTipIds = [4, 8, 12, 16, 20];
const FingerMcpIds = [1, 5, 9, 13, 17];
const MiddleMcpId = 9;

let handLandmarker = null;
let currentGesture = 'open';
let lastSwitchTime = 0;
let handCenter = { x: 0.5, y: 0.5 };
let handConfidence = 0;
let pointDir = { x: 1, y: 0 };
let isActive = false;
let videoEl = null;

export function getGesture() { return currentGesture; }
export function getHandCenter() { return handCenter; }
export function getConfidence() { return handConfidence; }
export function getPointDirection() { return pointDir; }
export function isRunning() { return isActive; }

export async function initGesture(videoElement) {
  videoEl = videoElement;

  const { HandLandmarker, FilesetResolver } = await import(
    '/mediapipe/tasks-vision.mjs'
  );

  const vision = await FilesetResolver.forVisionTasks(
    '/mediapipe/wasm'
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: '/mediapipe/model/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'IMAGE',
    numHands: 1,
    minHandDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5,
  });

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
    });
    videoEl.srcObject = stream;
    await videoEl.play();
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      document.getElementById('permission-prompt').classList.remove('hidden');
      document.getElementById('enable-camera').onclick = () => location.reload();
      return;
    }
    throw err;
  }

  // Offscreen canvas for frame capture
  const captureCanvas = document.createElement('canvas');
  captureCanvas.width = 1280;
  captureCanvas.height = 720;
  const ctx = captureCanvas.getContext('2d');

  isActive = true;
  console.log('Gesture detection active (IMAGE mode)');

  async function tick() {
    if (!isActive) return;
    if (videoEl.readyState >= 2) {
      ctx.drawImage(videoEl, 0, 0, 1280, 720);
      const results = handLandmarker.detect(captureCanvas);
      if (results.landmarks && results.landmarks.length > 0) {
        const lm = results.landmarks[0];
        handConfidence =
          results.handednesses && results.handednesses.length > 0 && results.handednesses[0].length > 0
            ? results.handednesses[0][0].score
            : 0.9;
        handCenter = { x: lm[MiddleMcpId].x, y: lm[MiddleMcpId].y };
        // Point direction: index tip - index mcp
        const tip8 = lm[8], mcp5 = lm[5];
        pointDir = { x: tip8.x - mcp5.x, y: tip8.y - mcp5.y };
        classifyGesture(lm);
      } else {
        handConfidence = 0;
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
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
  if (handLandmarker) {
    handLandmarker.close();
    handLandmarker = null;
  }
}
