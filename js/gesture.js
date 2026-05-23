// Cyber Particle — Gesture Detection via MediaPipe Hands
// Uses @mediapipe/tasks-vision HandLandmarker

import { HudManager } from './hud.js';

const ConfidenceThreshold = 0.7;
const DebounceMs = 250;
const FingerTipIds = [4, 8, 12, 16, 20];
const FingerPipIds = [2, 6, 10, 14, 18];
const FingerMcpIds = [1, 5, 9, 13, 17];
const WristId = 0;
const MiddleMcpId = 9;

let handLandmarker = null;
let currentGesture = 'open';
let lastSwitchTime = 0;
let handCenter = { x: 0.5, y: 0.5 };
let handConfidence = 0;
let running = false;
let lastVideoTime = -1;
let cameraStream = null;

export function getGesture() { return currentGesture; }
export function getHandCenter() { return handCenter; }
export function getConfidence() { return handConfidence; }

export async function initGesture(videoEl) {
  const { HandLandmarker, FilesetResolver } = await import(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm.js'
  );

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm'
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5,
  });

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
    });
    videoEl.srcObject = cameraStream;
    await videoEl.play();
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      document.getElementById('permission-prompt').classList.remove('hidden');
      document.getElementById('enable-camera').onclick = () => location.reload();
    }
    throw err;
  }

  running = true;
  requestAnimationFrame(detectLoop);
}

function detectLoop() {
  if (!running) return;
  const video = document.getElementById('webcam');

  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const results = handLandmarker.detectForVideo(video, performance.now());
    processResults(results);
  }

  requestAnimationFrame(detectLoop);
}

function processResults(results) {
  if (results.landmarks && results.landmarks.length > 0) {
    const lm = results.landmarks[0];
    handConfidence = results.worldLandmarks ? 0.9 : 0.8;
    handCenter = { x: lm[MiddleMcpId].x, y: lm[MiddleMcpId].y };
    classifyGesture(lm);
  } else {
    handConfidence = 0;
  }
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
  const thumbTip = lm[4];
  const indexTip = lm[8];
  const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

  let gesture = currentGesture;

  if (pinchDist < 0.05 && !middle && !ring && !pinky) {
    gesture = 'pinch';
  } else if (index && !middle && !ring && !pinky) {
    gesture = 'point';
  } else if (fingersExtended.every(Boolean)) {
    gesture = 'open';
  } else if (fingersExtended.every(f => !f)) {
    gesture = 'fist';
  }

  if (gesture !== currentGesture) {
    currentGesture = gesture;
    lastSwitchTime = now;
  }
}

export function stopGesture() {
  running = false;
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
  }
  if (handLandmarker) {
    handLandmarker.close();
  }
}
