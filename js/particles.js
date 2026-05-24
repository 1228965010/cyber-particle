// Cyber Particle — Ambient Particle Field + Hand Disturbance
import * as THREE from 'three';
import { getGesture, getHandCenter, getConfidence } from './gesture.js';

const ParticleCount = 12000;
const Damping = 0.93;

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
let positions, colors, velocities, basePositions, phases;
let clock = new THREE.Clock();
let animating = true;
let handleResize;

const palettes = {
  open:  [[0.0, 0.95, 1.0], [0.3, 0.5, 1.0], [0.0, 0.7, 0.9]],
  fist:  [[1.0, 0.1, 0.5], [0.9, 0.2, 0.0], [1.0, 0.4, 0.7]],
  pinch: [[0.0, 1.0, 0.5], [0.2, 0.9, 0.4], [0.0, 0.7, 0.6]],
  point: [[1.0, 0.1, 0.2], [1.0, 0.3, 0.1], [0.9, 0.2, 0.4]],
};
let currentPalette = palettes.open;
let targetPalette = palettes.open;
let paletteLerp = 1.0;

const cursor3D = new THREE.Vector3(0, 0, 0);
const cursorTarget = new THREE.Vector3(0, 0, 0);
const prevCursor = new THREE.Vector3(0, 0, 0);

function createGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.04, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.12, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.12)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.02)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function pickColor(palette, i, time) {
  const idx = i % palette.length;
  const c = palette[idx];
  const brightness = 0.6 + 0.4 * Math.sin(i * 0.05 + time * 0.7);
  return [c[0] * brightness, c[1] * brightness, c[2] * brightness];
}

function lerpColor(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function initParticles(canvas) {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0f, 0.00015);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 6;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const glowTexture = createGlowTexture();

  geometry = new THREE.BufferGeometry();
  positions = new Float32Array(ParticleCount * 3);
  basePositions = new Float32Array(ParticleCount * 3);
  colors = new Float32Array(ParticleCount * 3);
  velocities = new Float32Array(ParticleCount * 3);
  phases = new Float32Array(ParticleCount);

  for (let i = 0; i < ParticleCount; i++) {
    const i3 = i * 3;
    // Spread across entire visible volume (wider than screen)
    const x = (Math.random() - 0.5) * 14;
    const y = (Math.random() - 0.5) * 10;
    const z = (Math.random() - 0.5) * 8;
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
    basePositions[i3] = x;
    basePositions[i3 + 1] = y;
    basePositions[i3 + 2] = z;
    const c = pickColor(currentPalette, i, 0);
    colors[i3] = c[0];
    colors[i3 + 1] = c[1];
    colors[i3 + 2] = c[2];
    velocities[i3] = 0;
    velocities[i3 + 1] = 0;
    velocities[i3 + 2] = 0;
    phases[i] = Math.random() * Math.PI * 2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.05,
    map: glowTexture,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.8,
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

  // Hand position in 3D space
  cursorTarget.set(
    (center.x - 0.5) * 10,
    -(center.y - 0.5) * 7,
    0
  );
  prevCursor.copy(cursor3D);
  cursor3D.lerp(cursorTarget, hasHand ? 0.12 : 0.03);
  const handSpeed = prevCursor.distanceTo(cursor3D) / Math.max(dt, 0.001);

  // Palette transition
  targetPalette = palettes[gesture] || palettes.open;
  paletteLerp += (1.0 - paletteLerp) * 2.0 * dt;
  if (paletteLerp > 0.99) {
    currentPalette = targetPalette;
    paletteLerp = 1.0;
  }

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    const px = positions[i3];
    const py = positions[i3 + 1];
    const pz = positions[i3 + 2];
    const bx = basePositions[i3];
    const by = basePositions[i3 + 1];
    const bz = basePositions[i3 + 2];

    // Distance from hand
    const dx = px - cursor3D.x;
    const dy = py - cursor3D.y;
    const dz = pz - cursor3D.z;
    const distToHand = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;

    // Base gentle floating motion (ambient drift)
    const floatX = Math.sin(time * 0.3 + phases[i]) * 0.003;
    const floatY = Math.cos(time * 0.4 + phases[i] * 1.3) * 0.003;
    const floatZ = Math.sin(time * 0.35 + phases[i] * 0.7) * 0.002;

    let fx = (bx - px) * 0.005 + floatX;
    let fy = (by - py) * 0.005 + floatY;
    let fz = (bz - pz) * 0.005 + floatZ;

    if (hasHand) {
      // Hand influence: ripple effect
      const influenceRadius = 3.0 + handSpeed * 0.5;
      if (distToHand < influenceRadius) {
        const influence = 1.0 - distToHand / influenceRadius;
        // Push particles outward from hand (ripple)
        const pushForce = influence * influence * 0.04;
        fx += (dx / distToHand) * pushForce;
        fy += (dy / distToHand) * pushForce;
        fz += (dz / distToHand) * pushForce * 0.5;

        // Tangential swirl
        const swirlForce = influence * 0.01;
        fx += -dz * swirlForce;
        fz += dx * swirlForce;
      }
    }

    velocities[i3] += fx;
    velocities[i3 + 1] += fy;
    velocities[i3 + 2] += fz;

    velocities[i3] *= Damping;
    velocities[i3 + 1] *= Damping;
    velocities[i3 + 2] *= Damping;

    positions[i3] += velocities[i3];
    positions[i3 + 1] += velocities[i3 + 1];
    positions[i3 + 2] += velocities[i3 + 2];

    // Color: blend between current and target palette, brightness from hand proximity
    const lerpT = Math.min(paletteLerp, 1.0);
    const tc = targetPalette[i % targetPalette.length];
    const cc = currentPalette[i % currentPalette.length];
    const blended = lerpColor(cc, tc, lerpT);

    let brightness = 0.35 + 0.15 * Math.sin(phases[i] + time * 0.5);
    if (hasHand && distToHand < 4.0) {
      brightness += (1.0 - distToHand / 4.0) * 0.5;
    }
    brightness = Math.min(brightness, 1.0);

    colors[i3] = blended[0] * brightness;
    colors[i3 + 1] = blended[1] * brightness;
    colors[i3 + 2] = blended[2] * brightness;
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
