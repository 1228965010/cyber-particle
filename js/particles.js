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
let animating = true;
let handleResize;

const gestureColors = {
  open:   { r: 0.0, g: 0.94, b: 1.0 },
  fist:   { r: 1.0, g: 0.0, b: 1.0 },
  pinch:  { r: 0.0, g: 1.0, b: 0.53 },
  point:  { r: 1.0, g: 0.2, b: 0.4 },
};
let targetColor = gestureColors.open;
let currentColor = { ...gestureColors.open };

const ORIGIN = new THREE.Vector3(0, 0, 0);

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
    (center.x - 0.5) * 6,
    -(center.y - 0.5) * 4,
    0
  );
  cursor3D.lerp(cursorTarget, 0.1);

  targetColor = gestureColors[gesture] || gestureColors.open;
  const lerpSpeed = 3 * dt;
  currentColor.r += (targetColor.r - currentColor.r) * lerpSpeed;
  currentColor.g += (targetColor.g - currentColor.g) * lerpSpeed;
  currentColor.b += (targetColor.b - currentColor.b) * lerpSpeed;

  const hasHand = conf > 0.7;
  const forceCenter = hasHand ? cursor3D : ORIGIN;
  const forceRadius = hasHand ? 1.5 : 999;
  const time = performance.now() * 0.001;

  // gesture is captured once per frame, outside the loop — no per-particle switch overhead
  for (let i = 0; i < ParticleCount; i++) {
    const i3 = i * 3;
    let px = positions[i3];
    let py = positions[i3 + 1];
    let pz = positions[i3 + 2];

    let tx, ty, tz;
    const angle = (i / ParticleCount) * Math.PI * 20 + time * RotationSpeed;

    switch (gesture) {
      case 'open': {
        const dist = Math.sqrt(px * px + py * py + pz * pz) + 0.001;
        const radius = 2.5;
        tx = (px / dist) * radius + Math.sin(angle * 0.3) * 0.3;
        ty = (py / dist) * radius + Math.cos(angle * 0.3) * 0.3;
        tz = (pz / dist) * radius;
        break;
      }
      case 'fist': {
        const r = 1.0;
        const phi = Math.acos(2 * (i / ParticleCount) - 1);
        tx = r * Math.sin(phi) * Math.cos(angle);
        ty = r * Math.sin(phi) * Math.sin(angle);
        tz = r * Math.cos(phi);
        break;
      }
      case 'pinch': {
        const spiralR = 0.3 + (i / ParticleCount) * 2.5;
        const spiralAngle = angle + spiralR * 3;
        tx = Math.cos(spiralAngle) * spiralR;
        ty = Math.sin(spiralAngle) * spiralR * 0.3;
        tz = Math.sin(spiralAngle * 0.5) * 0.5;
        break;
      }
      case 'point': {
        const beamLen = (i / ParticleCount) * 4 - 2;
        const spread = (1 - i / ParticleCount) * 0.15;
        tx = beamLen;
        // Deterministic spread using particle index
        const offset1 = ((i * 2654435761) % 1000) / 1000 - 0.5;
        const offset2 = ((i * 1597334677) % 1000) / 1000 - 0.5;
        ty = offset1 * spread;
        tz = offset2 * spread;
        break;
      }
      default: {
        // Fallback to nebula
        const fd = Math.sqrt(px * px + py * py + pz * pz) + 0.001;
        tx = (px / fd) * 2.5;
        ty = (py / fd) * 2.5;
        tz = (pz / fd) * 2.5;
        break;
      }
    }

    const dx = px - forceCenter.x;
    const dy = py - forceCenter.y;
    const dz = pz - forceCenter.z;
    const distToHand = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;

    let forceMagnitude = ForceStrength;
    if (hasHand && distToHand < forceRadius) {
      const t = distToHand / forceRadius;
      forceMagnitude *= (1 - t) * 2;
    } else if (!hasHand) {
      forceMagnitude = ForceStrength * 0.2;
      tx = px + Math.sin(time + i * 0.01) * 0.01;
      ty = py + Math.cos(time + i * 0.01) * 0.01;
      tz = pz;
    }

    velocities[i3] += (tx - px) * forceMagnitude;
    velocities[i3 + 1] += (ty - py) * forceMagnitude;
    velocities[i3 + 2] += (tz - pz) * forceMagnitude;

    if (hasHand) {
      velocities[i3] -= (dx / distToHand) * ForceStrength * 0.5;
      velocities[i3 + 1] -= (dy / distToHand) * ForceStrength * 0.5;
      velocities[i3 + 2] -= (dz / distToHand) * ForceStrength * 0.5;
    }

    velocities[i3] *= Damping;
    velocities[i3 + 1] *= Damping;
    velocities[i3 + 2] *= Damping;

    positions[i3] += velocities[i3];
    positions[i3 + 1] += velocities[i3 + 1];
    positions[i3 + 2] += velocities[i3 + 2];

    colors[i3] = currentColor.r;
    colors[i3 + 1] = currentColor.g;
    colors[i3 + 2] = currentColor.b;
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
  }
  window.removeEventListener('resize', handleResize);
}
