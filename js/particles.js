// Cyber Particle — Vortex Particle System
import * as THREE from 'three';
import { getGesture, getHandCenter, getConfidence } from './gesture.js';

const ParticleCount = 10000;
const Damping = 0.96;

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
let positions, colors, velocities;
let clock = new THREE.Clock();
let animating = true;
let handleResize;

const palettes = {
  open:  [[0.0, 0.95, 1.0], [0.2, 0.6, 1.0], [0.0, 0.7, 0.9]],
  fist:  [[1.0, 0.1, 0.5], [1.0, 0.5, 0.1], [0.9, 0.2, 0.6]],
  pinch: [[0.0, 1.0, 0.5], [0.1, 0.9, 0.3], [0.0, 0.7, 0.6]],
  point: [[1.0, 0.1, 0.2], [1.0, 0.4, 0.1], [0.9, 0.2, 0.4]],
};

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
  colors = new Float32Array(ParticleCount * 3);
  velocities = new Float32Array(ParticleCount * 3);

  // Initialize particles in a large disk/ring
  for (let i = 0; i < ParticleCount; i++) {
    const i3 = i * 3;
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.3 + Math.random() * 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const z = (Math.random() - 0.5) * 2;
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
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

function respawnParticle(i3, cx, cy, cz) {
  // Respawn at outer edge of vortex
  const angle = Math.random() * Math.PI * 2;
  const radius = 3.0 + Math.random() * 2.5;
  positions[i3] = cx + Math.cos(angle) * radius;
  positions[i3 + 1] = cy + Math.sin(angle) * radius;
  positions[i3 + 2] = cz + (Math.random() - 0.5) * 2;
  velocities[i3] = 0;
  velocities[i3 + 1] = 0;
  velocities[i3 + 2] = 0;
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

  // Vortex parameters
  const suckStrength = 0.015;      // inward pull
  const swirlStrength = 0.025;     // tangential spin
  const coreRadius = 0.2;          // particles inside this get respawned
  const vortexRadius = 5.0;        // particles outside this don't feel vortex

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    const px = positions[i3];
    const py = positions[i3 + 1];
    const pz = positions[i3 + 2];

    const dx = px - hx;
    const dy = py - hy;
    const dz = pz - hz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;

    if (hasHand && dist < vortexRadius) {
      // Respawn particles that reach the core
      if (dist < coreRadius) {
        respawnParticle(i3, hx, hy, hz);
        continue;
      }

      // Suck inward (stronger closer to center)
      const suck = suckStrength / Math.max(dist, coreRadius);
      velocities[i3] -= (dx / dist) * suck;
      velocities[i3 + 1] -= (dy / dist) * suck;
      velocities[i3 + 2] -= (dz / dist) * suck * 0.4;

      // Swirl around (tangential)
      velocities[i3] += -dy * swirlStrength * 0.001;
      velocities[i3 + 1] += dx * swirlStrength * 0.001;

      // Swirl faster closer to center
      const tangStrength = swirlStrength / Math.max(dist * dist, 0.1);
      velocities[i3] += -dy * tangStrength;
      velocities[i3 + 1] += dx * tangStrength;

      // Gesture-specific modulation
      switch (gesture) {
        case 'open':
          // Wider, slower vortex
          velocities[i3] *= 0.98;
          velocities[i3 + 1] *= 0.98;
          break;
        case 'fist':
          // Faster, tighter vortex
          velocities[i3] -= (dx / dist) * suck * 0.8;
          velocities[i3 + 1] -= (dy / dist) * suck * 0.8;
          break;
        case 'pinch':
          // Strong spiral
          velocities[i3] += -dy * tangStrength * 0.5;
          velocities[i3 + 1] += dx * tangStrength * 0.5;
          break;
        case 'point':
          // Directional pull to the right
          velocities[i3] += 0.003;
          break;
      }

    } else {
      // No hand / outside vortex: gentle drift
      velocities[i3] += Math.sin(time * 0.4 + px * 0.3) * 0.0005;
      velocities[i3 + 1] += Math.cos(time * 0.5 + py * 0.3) * 0.0005;
      velocities[i3 + 2] += Math.sin(time * 0.35 + pz * 0.3) * 0.0003;
    }

    // Damping
    velocities[i3] *= Damping;
    velocities[i3 + 1] *= Damping;
    velocities[i3 + 2] *= Damping;

    // Update
    positions[i3] += velocities[i3];
    positions[i3 + 1] += velocities[i3 + 1];
    positions[i3 + 2] += velocities[i3 + 2];

    // Color: brightness based on distance to hand center
    const ci = i % palette.length;
    const c = palette[ci];
    let bright;
    if (hasHand && dist < vortexRadius) {
      bright = 0.4 + (1.0 - Math.min(dist, vortexRadius) / vortexRadius) * 0.6;
    } else {
      bright = 0.25 + 0.1 * Math.sin(i * 0.03 + time * 0.5);
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
