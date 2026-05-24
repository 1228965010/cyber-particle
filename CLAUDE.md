# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Run

```bash
npx serve /Users/xiayixiang/cyber-particle -p 3456
```

Open `http://localhost:3456`. Allow camera. MediaPipe loads WASM from local `node_modules/`, takes 3-8s.

## Architecture

Webcam → MediaPipe HandLandmarker (IMAGE mode, canvas capture) → gesture classification → Three.js particle simulation → HUD overlay.

### 4 gestures (classifyGesture in gesture.js)

| Gesture | HUD | Behavior | Color | Key params |
|---------|-----|----------|-------|------------|
| Open palm | NEBULA | Burst outward from hand | Cyan | `burst = 0.04 * depth * speedMul` |
| Fist | SPHERE | Vortex suction + swirl, core respawn | Magenta | `suck = 0.06/(dist²+0.05)`, `swirl = 0.03 * depth²` |
| Index point | BEAM | Gradual directional stream | Red | `streamForce = 0.03`, `axisPull = 0.02 * depth` |
| Pinch | HEART | Pulsing heart shape + particle jitter | Pink | `beat = 1 + sin(t*6)*0.08 + sin(t*12)*0.05` |

### Finger detection (gesture.js)

- Thumb: horizontal spread vs index MCP > 0.06
- Four fingers: pip.y - tip.y > 0.015 (tip above PIP = extended)
- Pinch: thumb+index tips < 0.06 AND middle+ring closed
- Point: only index extended, others closed
- Open: ≥4 fingers extended
- Fist: ≤1 finger extended
- Debounce: 250ms

### Particle physics (particles.js)

- 10000 particles, `size: 0.25`, glow texture + AdditiveBlending
- `speedMul` = hand-to-camera distance proxy (0.3-2.5x), multiplied into all forces
- `patternScale` = inverse of hand distance (close=small pattern, far=large), clamped 0.4-2.5
- `influenceRadius = 4.5 * patternScale` (used by all gestures)
- No hand: particles return to `restPositions` in gentle spring
- Fist/Pinch: distant particles get gentle pull even outside influenceRadius
- Key bindings: `1`=5000, `2`=8000, `3`=15000

### MediaPipe (gesture.js)

- Package: `@mediapipe/tasks-vision@0.10.21` (npm installed)
- Import: `/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs`
- WASM: `/node_modules/@mediapipe/tasks-vision/wasm`
- Model: `/mediapipe/model/hand_landmarker.task`
- Mode: IMAGE (manual canvas capture avoids VIDEO mode IMAGE_DIMENSIONS bug)

## Key files

- `index.html` — HTML shell, importmap for Three.js 0.160, module init
- `css/style.css` — CRT scanlines, vignette, hex grid, HUD
- `js/gesture.js` — MediaPipe init, gesture classification, camera
- `js/particles.js` — Three.js scene, particle physics, gesture behaviors
- `js/hud.js` — FPS, gesture name, confidence, status bar (shows LOADING until ready)

## Testing

```bash
node /tmp/test_cyber.js
```

Headless Playwright test. "Not supported" error expected (no camera). Zero JS errors = pass.
