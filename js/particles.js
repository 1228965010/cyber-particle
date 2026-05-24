// Cyber Particle — Three.js Particle Engine
// Trail-flow style: spring physics with speed gradient for natural trail effect
import * as THREE from 'three';
import { getGesture, getHandCenter, getConfidence } from './gesture.js';

const ParticleCount = 15000;
const Damping = 0.85;
const RotationSpeed = 0.015;

let particleCount = ParticleCount;
const LowCount = 5000;
const MediumCount = 8000;

export function setParticleCount(count) {
  particleCount = count;
  const el = document.getElementById('particle-count');
  if (el) el.textContent = `PARTICLES: ${count}`;
}

if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
  particleCount = LowCount;
}

let scene, camera, renderer, particles, geometry;
let positions, colors, velocities;
let springStiffness;
let clock = new THREE.Clock();
let animating = true;
let handleResize;

const gestureColors = {
  open:  [0.0, 0.94, 1.0],
  fist:  [1.0, 0.0, 1.0],
  pinch: [0.0, 1.0, 0.53],
  point: [1.0, 0.2, 0.4],
};
let targetColor = gestureColors.open;
let currentColor = [...gestureColors.open];

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
  gradient.addColorStop(0.05, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.15, 'rgba(255,255,255,0.7)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.25)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.05)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function initParticles(canvas) {
  scene = new THREE.Scene();

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
  springStiffness = new Float32Array(ParticleCount);

  for (let i = 0; i < ParticleCount; i++) {
    const i3 = i * 3;
    // Wide initial spread
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 0.5 + Math.random() * 4;
    positions[i3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
    positions[i3 + 2] = Math.cos(phi) * r * 0.6;
    colors[i3] = currentColor[0];
    colors[i3 + 1] = currentColor[1];
    colors[i3 + 2] = currentColor[2];
    velocities[i3] = 0;
    velocities[i3 + 1] = 0;
    velocities[i3 + 2] = 0;
    // Key: each particle has different spring stiffness for trail effect
    // Stiffness varies from 0.003 (slow, trailing far behind) to 0.08 (fast, close to hand)
    const t = i / ParticleCount;
    springStiffness[i] = 0.003 + t * t * 0.077;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.07,
    map: glowTexture,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.85,
  });

  particles = new THREE.Points(geometry, material);
  scene.add(particles);

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

  // Smooth cursor with different speeds for trail
  cursorTarget.set(
    (center.x - 0.5) * 8,
    -(center.y - 0.5) * 5.5,
    0
  );

  const hasHand = conf > 0.7;
  if (hasHand) {
    prevCursor.copy(cursor3D);
    cursor3D.lerp(cursorTarget, 0.15);
  } else {
    cursor3D.lerp(new THREE.Vector3(0, 0, 0), 0.02);
  }

  // Hand velocity for trail elongation
  const handSpeed = prevCursor.distanceTo(cursor3D) / Math.max(dt, 0.001);
  const trailLength = hasHand ? 0.3 + handSpeed * 0.3 : 0;

  // Color transition
  const tc = gestureColors[gesture] || gestureColors.open;
  targetColor = tc;
  const ls = 2.5 * dt;
  currentColor[0] += (targetColor[0] - currentColor[0]) * ls;
  currentColor[1] += (targetColor[1] - currentColor[1]) * ls;
  currentColor[2] += (targetColor[2] - currentColor[2]) * ls;

  const time = performance.now() * 0.001;

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    let px = positions[i3];
    let py = positions[i3 + 1];
    let pz = positions[i3 + 2];

    const stiffness = springStiffness[i];

    // Gesture-specific target position
    let tx, ty, tz;
    const angle = (i / ParticleCount) * Math.PI * 16 + time * RotationSpeed;

    if (hasHand) {
      // Use gesture-specific shapes around hand position
      const cx = cursor3D.x;
      const cy = cursor3D.y;
      const cz = cursor3D.z;

      switch (gesture) {
        case 'open':
          // Nebula burst around hand
          {
            const a = angle;
            const rad = 0.8 + stiffness * 15;
            tx = cx + Math.cos(a) * rad;
            ty = cy + Math.sin(a * 1.3) * rad * 0.7;
            tz = cz + Math.sin(a * 0.7) * rad * 0.5;
          }
          break;
        case 'fist':
          // Tight sphere
          {
            const phi = Math.acos(2 * (i / ParticleCount) - 1);
            const r = 0.5 + stiffness * 5;
            tx = cx + Math.sin(phi) * Math.cos(angle) * r;
            ty = cy + Math.sin(phi) * Math.sin(angle) * r;
            tz = cz + Math.cos(phi) * r;
          }
          break;
        case 'pinch':
          // Spiral
          {
            const sr = 0.15 + stiffness * 12;
            const sa = angle * 2 + sr * 2;
            tx = cx + Math.cos(sa) * sr;
            ty = cy + Math.sin(sa) * sr * 0.4;
            tz = cz + Math.sin(sa * 0.5) * 0.8;
          }
          break;
        case 'point':
          // Beam
          {
            const bl = stiffness * 15 - 3;
            const spread = 0.1 + (1 - stiffness) * 0.5;
            const o1 = ((i * 2654435761) % 1000) / 1000 - 0.5;
            const o2 = ((i * 1597334677) % 1000) / 1000 - 0.5;
            tx = cx + bl;
            ty = cy + o1 * spread;
            tz = cz + o2 * spread;
          }
          break;
        default:
          tx = cx; ty = cy; tz = cz;
      }
    } else {
      // Idle: gentle flowing drift
      tx = px + Math.sin(time * 0.5 + i * 0.003) * 0.02;
      ty = py + Math.cos(time * 0.6 + i * 0.004) * 0.02;
      tz = pz + Math.sin(time * 0.4 + i * 0.005) * 0.015;
    }

    // Spring force: pull toward target with individual stiffness (creates trail)
    const fx = (tx - px) * stiffness;
    const fy = (ty - py) * stiffness;
    const fz = (tz - pz) * stiffness;

    // Add organic noise wobble
    const noiseAmp = hasHand ? 0.0003 : 0.0001;
    velocities[i3] += fx + Math.sin(time * 3 + i * 0.1) * noiseAmp;
    velocities[i3 + 1] += fy + Math.cos(time * 2.5 + i * 0.1) * noiseAmp;
    velocities[i3 + 2] += fz + Math.sin(time * 2.8 + i * 0.12) * noiseAmp;

    velocities[i3] *= Damping;
    velocities[i3 + 1] *= Damping;
    velocities[i3 + 2] *= Damping;

    positions[i3] += velocities[i3];
    positions[i3 + 1] += velocities[i3 + 1];
    positions[i3 + 2] += velocities[i3 + 2];

    // Color: brightness based on closeness to hand (near = bright, far = dim = trail)
    const dx = positions[i3] - cursor3D.x;
    const dy = positions[i3 + 1] - cursor3D.y;
    const dz = positions[i3 + 2] - cursor3D.z;
    const distToHand = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const brightness = hasHand
      ? Math.max(0.15, 1.0 - distToHand / (5 + trailLength))
      : 0.2 + 0.1 * Math.sin(i * 0.02 + time);

    const flicker = 0.9 + 0.1 * Math.sin(i * 0.3 + time * 5);
    colors[i3] = currentColor[0] * brightness * flicker;
    colors[i3 + 1] = currentColor[1] * brightness * flicker;
    colors[i3 + 2] = currentColor[2] * brightness * flicker;
  }

  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;

  renderer.render(scene, camera);
}

export function disposeParticles() {
  animating = false;
  if (renderer) { renderer.dispose(); renderer = null; }
  if (geometry) { geometry.dispose(); geometry = null; }
  if (particles && particles.material) {
    particles.material.map?.dispose();
    particles.material.dispose();
  }
  window.removeEventListener('resize', handleResize);
}
