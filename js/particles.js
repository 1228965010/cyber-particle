// Cyber Particle — Three.js Particle Engine
import * as THREE from 'three';
import { getGesture, getHandCenter, getConfidence } from './gesture.js';

const ParticleCount = 15000;
const Damping = 0.94;
const ForceStrength = 0.004;
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
let sizes;
let clock = new THREE.Clock();
let animating = true;
let handleResize;

const gestureColors = {
  open:  { r: 0.0, g: 0.94, b: 1.0 },
  fist:  { r: 1.0, g: 0.0, b: 1.0 },
  pinch: { r: 0.0, g: 1.0, b: 0.53 },
  point: { r: 1.0, g: 0.2, b: 0.4 },
};
let targetColor = gestureColors.open;
let currentColor = { ...gestureColors.open };

const ORIGIN = new THREE.Vector3(0, 0, 0);
const cursor3D = new THREE.Vector3(0, 0, 0);
const cursorTarget = new THREE.Vector3(0, 0, 0);

function createGlowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.1, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.1)');
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
  sizes = new Float32Array(ParticleCount);

  for (let i = 0; i < ParticleCount; i++) {
    const i3 = i * 3;
    // Spherical shell distribution for wide cinematic spread
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1.5 + Math.random() * 4;
    positions[i3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
    positions[i3 + 2] = Math.cos(phi) * r * 0.6;
    colors[i3] = currentColor.r;
    colors[i3 + 1] = currentColor.g;
    colors[i3 + 2] = currentColor.b;
    velocities[i3] = (Math.random() - 0.5) * 0.01;
    velocities[i3 + 1] = (Math.random() - 0.5) * 0.01;
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.01;
    sizes[i] = 0.02 + Math.random() * 0.06;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: 0.06,
    map: glowTexture,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.9,
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

  cursorTarget.set(
    (center.x - 0.5) * 8,
    -(center.y - 0.5) * 5,
    0
  );
  cursor3D.lerp(cursorTarget, 0.08);

  targetColor = gestureColors[gesture] || gestureColors.open;
  const lerpSpeed = 2.5 * dt;
  currentColor.r += (targetColor.r - currentColor.r) * lerpSpeed;
  currentColor.g += (targetColor.g - currentColor.g) * lerpSpeed;
  currentColor.b += (targetColor.b - currentColor.b) * lerpSpeed;

  const hasHand = conf > 0.7;
  const forceCenter = hasHand ? cursor3D : ORIGIN;
  const time = performance.now() * 0.001;

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    let px = positions[i3];
    let py = positions[i3 + 1];
    let pz = positions[i3 + 2];

    let tx, ty, tz;
    const angle = (i / ParticleCount) * Math.PI * 16 + time * RotationSpeed;

    switch (gesture) {
      case 'open': {
        // Large nebula burst
        const dist = Math.sqrt(px * px + py * py + pz * pz) + 0.001;
        const radius = 3.5 + Math.sin(angle * 0.7) * 0.8;
        tx = (px / dist) * radius + Math.sin(angle) * 0.4;
        ty = (py / dist) * radius + Math.cos(angle * 1.3) * 0.4;
        tz = (pz / dist) * radius * 0.7 + Math.cos(angle * 0.5) * 0.5;
        break;
      }
      case 'fist': {
        // Dense pulsating sphere
        const r = 1.2 + Math.sin(time * 2) * 0.2;
        const phi = Math.acos(2 * (i / ParticleCount) - 1);
        tx = r * Math.sin(phi) * Math.cos(angle);
        ty = r * Math.sin(phi) * Math.sin(angle);
        tz = r * Math.cos(phi);
        break;
      }
      case 'pinch': {
        // Grand spiral galaxy
        const spiralR = 0.2 + (i / ParticleCount) * 4;
        const spiralAngle = angle * 2 + spiralR * 2.5;
        tx = Math.cos(spiralAngle) * spiralR;
        ty = Math.sin(spiralAngle) * spiralR * 0.4;
        tz = Math.sin(spiralAngle * 0.6) * 1.2;
        break;
      }
      case 'point': {
        // Wide beam / laser
        const beamLen = (i / ParticleCount) * 6 - 3;
        const spread = 0.3 + (1 - i / ParticleCount) * 0.6;
        const o1 = ((i * 2654435761) % 1000) / 1000 - 0.5;
        const o2 = ((i * 1597334677) % 1000) / 1000 - 0.5;
        tx = beamLen;
        ty = o1 * spread;
        tz = o2 * spread;
        break;
      }
      default: {
        const fd = Math.sqrt(px * px + py * py + pz * pz) + 0.001;
        tx = (px / fd) * 3.5;
        ty = (py / fd) * 3.5;
        tz = (pz / fd) * 2;
        break;
      }
    }

    // Attraction to hand
    const dx = px - forceCenter.x;
    const dy = py - forceCenter.y;
    const dz = pz - forceCenter.z;
    const distToHand = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;

    let forceMagnitude = ForceStrength;
    if (hasHand) {
      // Stronger pull near hand, weaker far away
      const attractRadius = 3.0;
      if (distToHand < attractRadius) {
        const t = distToHand / attractRadius;
        forceMagnitude *= (1 - t) * 3;
      }
      // Repel particles too close to hand
      if (distToHand < 0.4) {
        velocities[i3] += (dx / distToHand) * ForceStrength * 3;
        velocities[i3 + 1] += (dy / distToHand) * ForceStrength * 3;
        velocities[i3 + 2] += (dz / distToHand) * ForceStrength * 3;
      }
    } else {
      // Flowing idle motion
      forceMagnitude = ForceStrength * 0.15;
      tx = px + Math.sin(time * 0.5 + i * 0.003) * 0.04;
      ty = py + Math.cos(time * 0.6 + i * 0.004) * 0.04;
      tz = pz + Math.sin(time * 0.4 + i * 0.005) * 0.03;
    }

    velocities[i3] += (tx - px) * forceMagnitude;
    velocities[i3 + 1] += (ty - py) * forceMagnitude;
    velocities[i3 + 2] += (tz - pz) * forceMagnitude;

    if (hasHand) {
      velocities[i3] -= (dx / distToHand) * ForceStrength * 0.3;
      velocities[i3 + 1] -= (dy / distToHand) * ForceStrength * 0.3;
      velocities[i3 + 2] -= (dz / distToHand) * ForceStrength * 0.3;
    }

    velocities[i3] *= Damping;
    velocities[i3 + 1] *= Damping;
    velocities[i3 + 2] *= Damping;

    positions[i3] += velocities[i3];
    positions[i3 + 1] += velocities[i3 + 1];
    positions[i3 + 2] += velocities[i3 + 2];

    // Subtle color variation per particle
    const brightness = 0.7 + 0.3 * Math.sin(i * 0.1 + time);
    colors[i3] = currentColor.r * brightness;
    colors[i3 + 1] = currentColor.g * brightness;
    colors[i3 + 2] = currentColor.b * brightness;
  }

  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;

  renderer.render(scene, camera);
}

export function disposeParticles() {
  animating = false;
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  if (geometry) {
    geometry.dispose();
    geometry = null;
  }
  if (particles && particles.material) {
    particles.material.dispose();
    particles.material.map?.dispose();
  }
  window.removeEventListener('resize', handleResize);
}
