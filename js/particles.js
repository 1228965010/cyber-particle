// Cyber Particle — Gesture-Driven Particle Behaviors
import * as THREE from 'three';
import { getGesture, getHandCenter, getConfidence, getPointDirection } from './gesture.js';

const ParticleCount = 10000;
const Damping = 0.94;

let particleCount = ParticleCount;
const LowCount = 4000;
const MediumCount = 7000;

export function setParticleCount(count) {
  particleCount = count;
  const el = document.getElementById('particle-count');
  if (el) el.textContent = `PARTICLES: ${count}`;
}

if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
  particleCount = LowCount;
}

let scene, camera, renderer, geometry;
let positions, colors, velocities, restPositions;
let clock = new THREE.Clock();
let animating = true;
let handleResize;

const palettes = {
  open:  [[0.0, 0.95, 1.0], [0.2, 0.6, 1.0], [0.0, 0.7, 0.9]],
  fist:  [[1.0, 0.1, 0.5], [1.0, 0.5, 0.1], [0.9, 0.2, 0.6]],
  pinch: [[0.0, 1.0, 0.5], [0.1, 0.9, 0.3], [0.0, 0.7, 0.6]],
  point: [[1.0, 0.1, 0.2], [1.0, 0.4, 0.1], [0.9, 0.2, 0.4]],
};

let prevGesture = 'open';
const cursor3D = new THREE.Vector3(0, 0, 0);
const cursorTarget = new THREE.Vector3(0, 0, 0);

function createGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.12, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.03)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function initParticles(canvas) {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0f, 0.0002);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 6;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const glowTexture = createGlowTexture();

  geometry = new THREE.BufferGeometry();
  positions = new Float32Array(ParticleCount * 3);
  restPositions = new Float32Array(ParticleCount * 3);
  colors = new Float32Array(ParticleCount * 3);
  velocities = new Float32Array(ParticleCount * 3);

  for (let i = 0; i < ParticleCount; i++) {
    const i3 = i * 3;
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.5 + Math.random() * 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const z = (Math.random() - 0.5) * 3;
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
    restPositions[i3] = x;
    restPositions[i3 + 1] = y;
    restPositions[i3 + 2] = z;
    colors[i3] = 0.3;
    colors[i3 + 1] = 0.4;
    colors[i3 + 2] = 0.6;
    velocities[i3] = 0;
    velocities[i3 + 1] = 0;
    velocities[i3 + 2] = 0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.25,
    map: glowTexture,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.85,
  });

  scene.add(new THREE.Points(geometry, material));

  handleResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', handleResize);

  animate();
}

function animate() {
  if (!animating) return;
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.1);
  const gesture = getGesture();
  const center = getHandCenter();
  const conf = getConfidence();
  const hasHand = conf > 0.7;
  const time = performance.now() * 0.001;

  cursorTarget.set(
    (center.x - 0.5) * 8,
    -(center.y - 0.5) * 5.5,
    0
  );
  cursor3D.lerp(cursorTarget, 0.1);

  const palette = palettes[gesture] || palettes.open;
  const hx = cursor3D.x, hy = cursor3D.y, hz = cursor3D.z;

  // When gesture changes, respawn all particles around hand position
  if (gesture !== prevGesture) {
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const a = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 2.5;
      positions[i3] = hx + Math.cos(a) * r;
      positions[i3 + 1] = hy + Math.sin(a) * r;
      positions[i3 + 2] = hz + (Math.random() - 0.5) * 2;
      velocities[i3] = 0;
      velocities[i3 + 1] = 0;
      velocities[i3 + 2] = 0;
    }
    prevGesture = gesture;
  }

  // Point direction
  const pd = getPointDirection();
  const pdx = pd.x, pdy = -pd.y; // flip Y to match 3D space

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    const px = positions[i3];
    const py = positions[i3 + 1];
    const pz = positions[i3 + 2];

    const dx = px - hx;
    const dy = py - hy;
    const dz = pz - hz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;

    if (hasHand) {
      const influenceRadius = 4.5;

      switch (gesture) {
        // ===== 1. FIST: converge + vortex =====
        case 'fist':
          if (dist < influenceRadius) {
            const depth = 1.0 - dist / influenceRadius;
            // Strong suction toward center
            const suck = 0.06 / (dist * dist + 0.05);
            velocities[i3] -= (dx / dist) * suck;
            velocities[i3 + 1] -= (dy / dist) * suck;
            velocities[i3 + 2] -= (dz / dist) * suck * 0.4;
            // Spiral faster when closer
            const swirl = 0.03 * depth * depth;
            velocities[i3] += -dy * swirl;
            velocities[i3 + 1] += dx * swirl;
            // Respawn particles that reach the core
            if (dist < 0.2) {
              const a = Math.random() * Math.PI * 2;
              const r = 2.5 + Math.random();
              positions[i3] = hx + Math.cos(a) * r;
              positions[i3 + 1] = hy + Math.sin(a) * r;
              positions[i3 + 2] = hz + (Math.random() - 0.5) * 1.5;
              velocities[i3] = 0;
              velocities[i3 + 1] = 0;
              velocities[i3 + 2] = 0;
            }
          }
          break;

        // ===== 2. OPEN: burst outward from center =====
        case 'open':
          if (dist < influenceRadius) {
            const depth = 1.0 - dist / influenceRadius;
            // Push particles outward
            const burst = 0.04 * depth;
            velocities[i3] += (dx / dist) * burst;
            velocities[i3 + 1] += (dy / dist) * burst;
            velocities[i3 + 2] += (dz / dist) * burst * 0.3;
            // Add radial speed
            velocities[i3] += dx * 0.002;
            velocities[i3 + 1] += dy * 0.002;
          }
          break;

        // ===== 3. POINT: gradual stream in pointing direction =====
        case 'point': {
          const dirLen = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
          const ndx = pdx / dirLen, ndy = pdy / dirLen;
          // Perpendicular direction for stream width
          const perpX = -ndy, perpY = ndx;

          // Distance from the stream axis (line through hand in pointing direction)
          const proj = dx * ndx + dy * ndy; // projection along direction
          const perp = -dx * ndy + dy * ndx; // perpendicular distance to axis

          if (dist < influenceRadius) {
            const depth = 1.0 - dist / influenceRadius;

            // Pull particles toward the stream axis (perpendicular correction)
            const axisPull = 0.02 * depth;
            velocities[i3] -= perpX * perp * axisPull * 0.1;
            velocities[i3 + 1] -= perpY * perp * axisPull * 0.1;

            // Once near axis, accelerate along pointing direction
            const streamWidth = Math.abs(perp);
            if (streamWidth < 1.5) {
              const streamForce = 0.03 * (1.0 - streamWidth / 1.5);
              velocities[i3] += ndx * streamForce;
              velocities[i3 + 1] += ndy * streamForce;
            }

            // Particles behind the hand get stronger push forward
            if (proj < 0) {
              const push = 0.02 * depth;
              velocities[i3] += ndx * push;
              velocities[i3 + 1] += ndy * push;
            }
          }
          break;
        }

        // ===== 4. PINCH: converge into small circle =====
        case 'pinch':
          if (dist < influenceRadius) {
            const depth = 1.0 - dist / influenceRadius;
            // Pull toward hand
            const pull = 0.04 * depth;
            velocities[i3] -= (dx / dist) * pull;
            velocities[i3 + 1] -= (dy / dist) * pull;
            velocities[i3 + 2] -= (dz / dist) * pull * 0.4;
            // Orbit at a specific radius to form a ring
            const ringRadius = 0.6;
            if (dist < ringRadius * 1.5) {
              // Tangential force to maintain orbit
              const orbitForce = 0.02;
              velocities[i3] += -dy * orbitForce;
              velocities[i3 + 1] += dx * orbitForce;
              // Radial correction: push to ring radius
              const radialCorr = (dist - ringRadius) * 0.03;
              velocities[i3] -= (dx / dist) * radialCorr;
              velocities[i3 + 1] -= (dy / dist) * radialCorr;
            }
          }
          break;
      }

    } else {
      // No hand: return to rest positions
      const rx = restPositions[i3];
      const ry = restPositions[i3 + 1];
      const rz = restPositions[i3 + 2];
      velocities[i3] += (rx - px) * 0.005;
      velocities[i3 + 1] += (ry - py) * 0.005;
      velocities[i3 + 2] += (rz - pz) * 0.005;
    }

    // Damping
    velocities[i3] *= Damping;
    velocities[i3 + 1] *= Damping;
    velocities[i3 + 2] *= Damping;

    positions[i3] += velocities[i3];
    positions[i3 + 1] += velocities[i3 + 1];
    positions[i3 + 2] += velocities[i3 + 2];

    // Color
    const ci = i % palette.length;
    const c = palette[ci];
    const nowDist = Math.sqrt(
      (positions[i3] - hx) ** 2 + (positions[i3 + 1] - hy) ** 2 + (positions[i3 + 2] - hz) ** 2
    );
    let bright;
    if (hasHand && nowDist < 4.5) {
      bright = 0.4 + (1.0 - Math.min(nowDist, 4.5) / 4.5) * 0.6;
    } else {
      bright = 0.3 + 0.1 * Math.sin(i * 0.03 + time * 0.5);
    }
    bright = Math.max(0.1, Math.min(bright, 1.0));
    colors[i3] = c[0] * bright;
    colors[i3 + 1] = c[1] * bright;
    colors[i3 + 2] = c[2] * bright;
  }

  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;

  renderer.render(scene, camera);
}

export function disposeParticles() {
  animating = false;
  if (renderer) { renderer.dispose(); renderer = null; }
  if (geometry) { geometry.dispose(); geometry = null; }
  const pts = scene?.children[0];
  if (pts?.material) { pts.material.map?.dispose(); pts.material.dispose(); }
  window.removeEventListener('resize', handleResize);
}
