// Cyber Particle — Strong Hand-Responsive Particle Field
import * as THREE from 'three';
import { getGesture, getHandCenter, getConfidence } from './gesture.js';

const ParticleCount = 10000;
const Damping = 0.88;

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
  open:  [[0.0, 0.95, 1.0], [0.2, 0.5, 1.0], [0.0, 0.7, 0.9]],
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
  restPositions = new Float32Array(ParticleCount * 3);
  colors = new Float32Array(ParticleCount * 3);
  velocities = new Float32Array(ParticleCount * 3);

  // Spread particles across the full visible volume
  for (let i = 0; i < ParticleCount; i++) {
    const i3 = i * 3;
    const x = (Math.random() - 0.5) * 10;
    const y = (Math.random() - 0.5) * 7;
    const z = (Math.random() - 0.5) * 5;
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

  // Map hand to 3D space
  cursorTarget.set(
    (center.x - 0.5) * 8,
    -(center.y - 0.5) * 5.5,
    0
  );
  cursor3D.lerp(cursorTarget, 0.1);

  const palette = palettes[gesture] || palettes.open;
  const hx = cursor3D.x, hy = cursor3D.y, hz = cursor3D.z;

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    const px = positions[i3];
    const py = positions[i3 + 1];
    const pz = positions[i3 + 2];

    // Distance to hand
    const dx = px - hx;
    const dy = py - hy;
    const dz = pz - hz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;

    if (hasHand) {
      const attractRadius = 5.0;
      const influence = dist < attractRadius ? 1.0 - dist / attractRadius : 0;
      const strength = influence * influence;

      // Gesture-specific target shape around hand
      let tx = hx, ty = hy, tz = hz;

      switch (gesture) {
        case 'open': {
          // Wide burst ring around hand
          const ringR = 1.5 + strength * 2;
          const ang = Math.atan2(py - hy, px - hx) + time * 0.5;
          tx = hx + Math.cos(ang) * ringR;
          ty = hy + Math.sin(ang) * ringR;
          tz = hz + (pz - hz) * 0.3;
          break;
        }
        case 'fist': {
          // Dense cluster close to hand
          const clusterR = 0.3 + strength * 0.8;
          const ang = Math.atan2(py - hy, px - hx);
          const vertAng = Math.atan2(Math.sqrt(dx * dx + dy * dy), dz);
          tx = hx + Math.sin(vertAng) * Math.cos(ang) * clusterR;
          ty = hy + Math.sin(vertAng) * Math.sin(ang) * clusterR;
          tz = hz + Math.cos(vertAng) * clusterR;
          break;
        }
        case 'pinch': {
          // Flat spiral disk
          const spiralR = 0.3 + strength * 3;
          const ang = Math.atan2(py - hy, px - hx) + spiralR * 1.5 + time;
          tx = hx + Math.cos(ang) * spiralR;
          ty = hy + Math.sin(ang) * spiralR;
          tz = hz + (pz - hz) * 0.1;
          break;
        }
        case 'point': {
          // Stream to the right (pointing direction)
          const streamX = 0.3 + strength * 4;
          tx = hx + streamX;
          ty = hy + (pz * 0.5);
          tz = hz + (py - hy) * 0.3;
          break;
        }
      }

      // Strong pull toward target shape
      const pull = strength * 0.06;
      velocities[i3] += (tx - px) * pull;
      velocities[i3 + 1] += (ty - py) * pull;
      velocities[i3 + 2] += (tz - pz) * pull;

      // Direct attraction to hand (stronger for close particles)
      const attract = 0.03 / Math.max(dist, 0.1);
      velocities[i3] -= dx * attract * strength;
      velocities[i3 + 1] -= dy * attract * strength;
      velocities[i3 + 2] -= dz * attract * strength;

    } else {
      // No hand: gentle return to rest positions
      const rx = restPositions[i3];
      const ry = restPositions[i3 + 1];
      const rz = restPositions[i3 + 2];
      const returnForce = 0.003;
      velocities[i3] += (rx - px) * returnForce;
      velocities[i3 + 1] += (ry - py) * returnForce;
      velocities[i3 + 2] += (rz - pz) * returnForce;

      // Gentle ambient drift
      velocities[i3] += Math.sin(time * 0.4 + i * 0.003) * 0.0008;
      velocities[i3 + 1] += Math.cos(time * 0.5 + i * 0.004) * 0.0008;
      velocities[i3 + 2] += Math.sin(time * 0.35 + i * 0.005) * 0.0005;
    }

    // Damping
    velocities[i3] *= Damping;
    velocities[i3 + 1] *= Damping;
    velocities[i3 + 2] *= Damping;

    // Update position
    positions[i3] += velocities[i3];
    positions[i3 + 1] += velocities[i3 + 1];
    positions[i3 + 2] += velocities[i3 + 2];

    // Color: palette based on gesture, brightness based on hand proximity
    const ci = i % palette.length;
    const c = palette[ci];
    let bright;
    if (hasHand) {
      bright = 0.4 + (1.0 - Math.min(dist, 5.0) / 5.0) * 0.6;
    } else {
      bright = 0.3 + 0.15 * Math.sin(i * 0.04 + time * 0.6);
    }
    bright = Math.max(0.15, Math.min(bright, 1.0));

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
