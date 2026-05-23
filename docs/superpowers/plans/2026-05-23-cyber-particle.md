# Cyber Particle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cyberpunk-themed web app that uses webcam + MediaPipe Hands to control 15000+ Three.js particles with 4 hand gestures (open, fist, pinch, point).

**Architecture:** Single-page web app with three JS modules — gesture detection (MediaPipe Hands), particle engine (Three.js BufferGeometry), and HUD overlay. Particles respond to hand position as a force field and switch shape/color based on classified gesture.

**Tech Stack:** HTML5 + CSS3, Three.js (CDN importmap), MediaPipe Hands (CDN), vanilla JavaScript ES modules

---

### Task 1: Project scaffold and HTML shell

**Files:**
- Create: `cyber-particle/index.html`
- Create: `cyber-particle/css/style.css`
- Create: `cyber-particle/js/gesture.js`
- Create: `cyber-particle/js/particles.js`
- Create: `cyber-particle/js/hud.js`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p cyber-particle/css cyber-particle/js
```

- [ ] **Step 2: Write `cyber-particle/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cyber Particle</title>
  <link rel="stylesheet" href="css/style.css">
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
    }
  }
  </script>
</head>
<body>
  <video id="webcam" autoplay playsinline></video>
  <canvas id="particle-canvas"></canvas>

  <div id="hud">
    <div id="gesture-name">INITIALIZING<span class="cursor">_</span></div>
    <div id="gesture-bar">
      <span class="bar-segment" data-gesture="open">OPEN</span>
      <span class="bar-segment" data-gesture="fist">FIST</span>
      <span class="bar-segment" data-gesture="pinch">PINCH</span>
      <span class="bar-segment" data-gesture="point">POINT</span>
    </div>
    <div id="sys-info">
      <span id="fps-display">FPS: --</span>
      <span id="particle-count">PARTICLES: 15000</span>
      <span id="confidence-display">CONF: --</span>
    </div>
    <div id="permission-prompt" class="hidden">
      <p>CAMERA ACCESS REQUIRED</p>
      <button id="enable-camera">ENABLE</button>
    </div>
  </div>

  <div id="scanlines"></div>
  <div id="vignette"></div>

  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"></script>
  <script type="module" src="js/particles.js"></script>
  <script type="module" src="js/gesture.js"></script>
  <script type="module" src="js/hud.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write `cyber-particle/css/style.css`**

```css
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: #0a0a0f;
  overflow: hidden;
  font-family: 'Courier New', monospace;
  color: #00f0ff;
  height: 100vh;
  width: 100vw;
  user-select: none;
}

#webcam {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

#particle-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

/* Hex grid background */
body::before {
  content: '';
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background-image:
    linear-gradient(rgba(0, 240, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  z-index: 0;
  pointer-events: none;
}

/* CRT scanlines */
#scanlines {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.06) 2px,
    rgba(0, 0, 0, 0.06) 4px
  );
  z-index: 10;
  pointer-events: none;
}

/* Vignette */
#vignette {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.7) 100%);
  z-index: 9;
  pointer-events: none;
}

/* HUD */
#hud {
  position: fixed;
  z-index: 20;
  pointer-events: none;
}

#gesture-name {
  position: fixed;
  bottom: 60px;
  left: 40px;
  font-size: 48px;
  font-weight: bold;
  letter-spacing: 4px;
  text-transform: uppercase;
  text-shadow: 0 0 20px rgba(0, 240, 255, 0.8), 0 0 60px rgba(0, 240, 255, 0.4);
}

.cursor {
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

#gesture-bar {
  position: fixed;
  bottom: 30px;
  left: 40px;
  display: flex;
  gap: 20px;
}

.bar-segment {
  font-size: 11px;
  letter-spacing: 2px;
  opacity: 0.3;
  transition: opacity 0.3s, text-shadow 0.3s;
}

.bar-segment.active {
  opacity: 1;
  text-shadow: 0 0 10px currentColor;
}

.bar-segment[data-gesture="open"] { color: #00f0ff; }
.bar-segment[data-gesture="fist"] { color: #ff00ff; }
.bar-segment[data-gesture="pinch"] { color: #00ff88; }
.bar-segment[data-gesture="point"] { color: #ff3366; }

#sys-info {
  position: fixed;
  top: 30px;
  right: 40px;
  display: flex;
  gap: 30px;
  font-size: 12px;
  letter-spacing: 2px;
  opacity: 0.5;
}

#permission-prompt {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: all;
  z-index: 30;
}

#permission-prompt p {
  font-size: 24px;
  letter-spacing: 4px;
  margin-bottom: 20px;
  text-shadow: 0 0 20px rgba(0, 240, 255, 0.6);
}

#enable-camera {
  background: transparent;
  border: 1px solid #00f0ff;
  color: #00f0ff;
  padding: 12px 40px;
  font-family: inherit;
  font-size: 16px;
  letter-spacing: 4px;
  cursor: pointer;
  transition: background 0.2s, box-shadow 0.2s;
}

#enable-camera:hover {
  background: rgba(0, 240, 255, 0.1);
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.3);
}

.hidden {
  display: none !important;
}
```

- [ ] **Step 4: Commit**

```bash
cd cyber-particle && git init && git add -A && git commit -m "feat: scaffold project with HTML shell and styles"
```

---

### Task 2: Gesture detection module

**Files:**
- Write: `cyber-particle/js/gesture.js`

- [ ] **Step 1: Write `cyber-particle/js/gesture.js`**

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
cd cyber-particle && git add js/gesture.js && git commit -m "feat: add MediaPipe hand gesture detection"
```

---

### Task 3: Particle system

**Files:**
- Write: `cyber-particle/js/particles.js`

- [ ] **Step 1: Write `cyber-particle/js/particles.js`**

```javascript
// Cyber Particle — Three.js Particle Engine
import * as THREE from 'three';
import { getGesture, getHandCenter, getConfidence } from './gesture.js';

const ParticleCount = 15000;
const Damping = 0.92;
const ForceStrength = 0.003;
const RotationSpeed = 0.02;

let scene, camera, renderer, particles, geometry;
let positions, colors, velocities;
let clock = new THREE.Clock();

const gestureColors = {
  open:   { r: 0.0, g: 0.94, b: 1.0 },
  fist:   { r: 1.0, g: 0.0, b: 1.0 },
  pinch:  { r: 0.0, g: 1.0, b: 0.53 },
  point:  { r: 1.0, g: 0.2, b: 0.4 },
};
let targetColor = gestureColors.open;
let currentColor = { ...gestureColors.open };

const cursor3D = new THREE.Vector3(0, 0, 0);
const cursorTarget = new THREE.Vector3(0, 0, 0);

export function initParticles(canvas) {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  geometry = new THREE.BufferGeometry();
  positions = new Float32Array(ParticleCount * 3);
  colors = new Float32Array(ParticleCount * 3);
  velocities = new Float32Array(ParticleCount * 3);

  for (let i = 0; i < ParticleCount; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 6;
    positions[i3 + 1] = (Math.random() - 0.5) * 6;
    positions[i3 + 2] = (Math.random() - 0.5) * 4;
    colors[i3] = currentColor.r;
    colors[i3 + 1] = currentColor.g;
    colors[i3 + 2] = currentColor.b;
    velocities[i3] = 0;
    velocities[i3 + 1] = 0;
    velocities[i3 + 2] = 0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.008,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.85,
  });

  particles = new THREE.Points(geometry, material);
  scene.add(particles);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  animate();
}

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.1);
  const gesture = getGesture();
  const center = getHandCenter();
  const conf = getConfidence();

  cursorTarget.set(
    (center.x - 0.5) * 6,
    -(center.y - 0.5) * 4,
    0
  );
  cursor3D.lerp(cursorTarget, 0.1);

  // Color transition
  targetColor = gestureColors[gesture] || gestureColors.open;
  const lerpSpeed = 3 * dt;
  currentColor.r += (targetColor.r - currentColor.r) * lerpSpeed;
  currentColor.g += (targetColor.g - currentColor.g) * lerpSpeed;
  currentColor.b += (targetColor.b - currentColor.b) * lerpSpeed;

  const hasHand = conf > 0.7;
  const forceCenter = hasHand ? cursor3D : new THREE.Vector3(0, 0, 0);
  const forceRadius = hasHand ? 1.5 : 999;
  const time = performance.now() * 0.001;

  for (let i = 0; i < ParticleCount; i++) {
    const i3 = i * 3;
    let px = positions[i3];
    let py = positions[i3 + 1];
    let pz = positions[i3 + 2];

    // Gesture-specific target
    let tx, ty, tz;
    const angle = (i / ParticleCount) * Math.PI * 20 + time * RotationSpeed;

    switch (gesture) {
      case 'open':
        // Nebula: particles radiate outward from center
        const dist = Math.sqrt(px * px + py * py + pz * pz) + 0.001;
        const radius = 2.5;
        tx = (px / dist) * radius + Math.sin(angle * 0.3) * 0.3;
        ty = (py / dist) * radius + Math.cos(angle * 0.3) * 0.3;
        tz = (pz / dist) * radius;
        break;

      case 'fist':
        // Dense sphere with rotation
        const r = 1.0;
        const phi = Math.acos(2 * (i / ParticleCount) - 1);
        const theta = angle;
        tx = r * Math.sin(phi) * Math.cos(theta);
        ty = r * Math.sin(phi) * Math.sin(theta);
        tz = r * Math.cos(phi);
        break;

      case 'pinch':
        // Spiral galaxy
        const spiralR = 0.3 + (i / ParticleCount) * 2.5;
        const spiralAngle = angle + spiralR * 3;
        tx = Math.cos(spiralAngle) * spiralR;
        ty = Math.sin(spiralAngle) * spiralR * 0.3;
        tz = Math.sin(spiralAngle * 0.5) * 0.5;
        break;

      case 'point':
        // Beam in pointing direction
        const beamLen = (i / ParticleCount) * 4 - 2;
        const spread = (1 - i / ParticleCount) * 0.15;
        tx = beamLen;
        ty = (Math.random() - 0.5) * spread;
        tz = (Math.random() - 0.5) * spread;
        break;
    }

    // Force field from hand position
    const dx = px - forceCenter.x;
    const dy = py - forceCenter.y;
    const dz = pz - forceCenter.z;
    const distToHand = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;

    let forceMagnitude = ForceStrength;
    if (hasHand && distToHand < forceRadius) {
      const t = distToHand / forceRadius;
      forceMagnitude *= (1 - t) * 2;
    } else if (!hasHand) {
      // Idle drift
      forceMagnitude = ForceStrength * 0.2;
      tx = px + Math.sin(time + i * 0.01) * 0.01;
      ty = py + Math.cos(time + i * 0.01) * 0.01;
      tz = pz;
    }

    // Apply forces toward target
    velocities[i3] += (tx - px) * forceMagnitude;
    velocities[i3 + 1] += (ty - py) * forceMagnitude;
    velocities[i3 + 2] += (tz - pz) * forceMagnitude;

    // Attraction to hand
    if (hasHand) {
      velocities[i3] -= (dx / distToHand) * ForceStrength * 0.5;
      velocities[i3 + 1] -= (dy / distToHand) * ForceStrength * 0.5;
      velocities[i3 + 2] -= (dz / distToHand) * ForceStrength * 0.5;
    }

    // Damping
    velocities[i3] *= Damping;
    velocities[i3 + 1] *= Damping;
    velocities[i3 + 2] *= Damping;

    // Update position
    positions[i3] += velocities[i3];
    positions[i3 + 1] += velocities[i3 + 1];
    positions[i3 + 2] += velocities[i3 + 2];

    // Update color
    colors[i3] = currentColor.r;
    colors[i3 + 1] = currentColor.g;
    colors[i3 + 2] = currentColor.b;
  }

  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;

  renderer.render(scene, camera);
}
```

- [ ] **Step 2: Commit**

```bash
cd cyber-particle && git add js/particles.js && git commit -m "feat: add Three.js particle system with 4 gesture modes"
```

---

### Task 4: HUD module

**Files:**
- Write: `cyber-particle/js/hud.js`

- [ ] **Step 1: Write `cyber-particle/js/hud.js`**

```javascript
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
    // FPS
    fpsFrames++;
    const now = performance.now();
    if (now - fpsTime >= 500) {
      fpsDisplay = Math.round(fpsFrames / ((now - fpsTime) / 1000));
      fpsFrames = 0;
      fpsTime = now;
    }

    document.getElementById('fps-display').textContent = `FPS: ${fpsDisplay}`;

    // Gesture name
    const gesture = getGesture();
    const nameEl = document.getElementById('gesture-name');
    nameEl.innerHTML = `${gestureNames[gesture] || '--'}<span class="cursor">_</span>`;

    // Confidence
    const conf = getConfidence();
    document.getElementById('confidence-display').textContent =
      `CONF: ${(conf * 100).toFixed(0)}%`;

    // Gesture bar
    document.querySelectorAll('.bar-segment').forEach(seg => {
      seg.classList.toggle('active', seg.dataset.gesture === gesture);
    });
  }
}

// Auto-update via requestAnimationFrame
function hudLoop() {
  HudManager.update();
  requestAnimationFrame(hudLoop);
}
requestAnimationFrame(hudLoop);
```

- [ ] **Step 2: Commit**

```bash
cd cyber-particle && git add js/hud.js && git commit -m "feat: add HUD display with FPS, gesture name, status bar"
```

---

### Task 5: Integration — wire everything together

**Files:**
- Modify: `cyber-particle/index.html`

- [ ] **Step 1: Update `cyber-particle/index.html` to add init script**

Replace the script section at the bottom of index.html:

```html
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"></script>
  <script type="module">
    import { initParticles } from './js/particles.js';
    import { initGesture } from './js/gesture.js';
    import './js/hud.js';

    const video = document.getElementById('webcam');
    const canvas = document.getElementById('particle-canvas');
    const prompt = document.getElementById('permission-prompt');
    const enableBtn = document.getElementById('enable-camera');

    enableBtn.addEventListener('click', async () => {
      prompt.classList.add('hidden');
      try {
        await initGesture(video);
      } catch (e) {
        prompt.classList.remove('hidden');
        console.error('Camera init failed:', e);
      }
    });

    initParticles(canvas);

    // Auto-start: try camera immediately, show prompt if denied
    initGesture(video).catch((err) => {
      if (err.name === 'NotAllowedError') {
        prompt.classList.remove('hidden');
      }
    });
  </script>
```

The full `<script>` block replaces the 3 individual module script tags.

- [ ] **Step 2: Verify file structure**

```bash
find cyber-particle -type f | sort
```

Expected:
```
cyber-particle/css/style.css
cyber-particle/index.html
cyber-particle/js/gesture.js
cyber-particle/js/hud.js
cyber-particle/js/particles.js
```

- [ ] **Step 3: Commit**

```bash
cd cyber-particle && git add index.html && git commit -m "feat: wire up gesture detection, particles, and HUD"
```

---

### Task 6: Performance optimization

**Files:**
- Modify: `cyber-particle/js/particles.js`

- [ ] **Step 1: Add particle count toggle**

At the top of `particles.js`, add after the existing constants:

```javascript
let particleCount = ParticleCount;
const LowCount = 5000;
const MediumCount = 8000;

export function setParticleCount(count) {
  particleCount = count;
  document.getElementById('particle-count').textContent = `PARTICLES: ${count}`;
  // Rebuild geometry on next frame (handled in animate)
}

// Auto-detect low-end devices
if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
  particleCount = LowCount;
}
```

Update the animate loop to only iterate `particleCount` particles:

```javascript
for (let i = 0; i < particleCount; i++) {
```

Add keybindings in the inline module script in `index.html`:

```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === '1') setParticleCount(5000);
  if (e.key === '2') setParticleCount(8000);
  if (e.key === '3') setParticleCount(15000);
});
```

Import `setParticleCount` in the inline module:

```javascript
import { initParticles, setParticleCount } from './js/particles.js';
```

- [ ] **Step 2: Commit**

```bash
cd cyber-particle && git add js/particles.js index.html && git commit -m "feat: add particle count toggle and low-end device detection"
```

---

### Task 7: Launch and verify

- [ ] **Step 1: Start a local dev server**

```bash
cd cyber-particle && npx serve .
```

Expected: Server starts, shows local URL (e.g., http://localhost:3000)

- [ ] **Step 2: Open in browser and verify**

Open the URL in a browser. Verify:
- Camera permission prompt appears
- After allowing camera, particles render with cyberpunk visuals
- CRT scanlines and vignette overlay visible
- Moving hand changes particle behavior
- Four gestures (open/fist/pinch/point) switch particle shapes and colors
- HUD shows gesture name, FPS, confidence
- Pressing 1/2/3 toggles particle count

- [ ] **Step 3: Commit any final tweaks**

```bash
cd cyber-particle && git add -A && git commit -m "chore: final polish and verification"
```
