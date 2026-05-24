# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Run

```bash
npx serve /Users/xiayixiang/cyber-particle -p 3456
```

Open `http://localhost:3456`. Allow camera. MediaPipe loads WASM (~9MB) from local `node_modules/`, takes 3-8s.

## Architecture

Webcam → MediaPipe Hands (IMAGE mode, canvas capture) → gesture classification → Three.js particle simulation → HUD overlay.

**4 gestures (classifyGesture in gesture.js):**
| Gesture | HUD | Particle behavior | Color |
|---------|-----|-------------------|-------|
| Open palm | NEBULA | Burst outward from hand | Cyan |
| Fist | SPHERE | Vortex suction + swirl | Magenta |
| Index point | BEAM | Gradual directional stream | Red |
| Pinch | HEART | Converge into heart shape | Pink |

**Finger detection (gesture.js:97-121):** Thumb checked by horizontal spread vs index MCP. Other 4 fingers checked by tip-above-PIP (pip.y - tip.y > 0.02). Debounce 250ms.

**Particle physics (particles.js):**
- 10000 particles, size 0.25, glow texture + AdditiveBlending
- Each gesture has its own force logic inside `switch(gesture)` in `animate()`
- `speedMul` = hand-to-camera distance (0.3-2.5x), applied to all forces
- No hand: particles return to `restPositions` (original spread)
- Key bindings: 1=5000, 2=8000, 3=15000 particles

**MediaPipe (gesture.js):** Uses `@mediapipe/tasks-vision@0.10.21` npm package. Dynamic import from `/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs`. WASM at `/node_modules/@mediapipe/tasks-vision/wasm`. Hand landmark model at `/mediapipe/model/hand_landmarker.task`.

## Key files

- `index.html` — HTML shell, Three.js importmap, module init script
- `css/style.css` — CRT scanlines, vignette, hex grid, HUD styles
- `js/gesture.js` — MediaPipe init, gesture classification, camera capture
- `js/particles.js` — Three.js scene, particle physics, gesture behaviors
- `js/hud.js` — FPS, gesture name, confidence display, status bar

## Testing

```bash
node /tmp/test_cyber.js
```

Headless Playwright test. Expects server on `:3456`. Will show "Not supported" error because headless Chromium has no camera — this is expected. Real test requires a real browser with webcam.
