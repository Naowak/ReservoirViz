'use client';

import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/* ─────────────────────────────────────────────────────────────
   VISUAL CONFIG (unchanged geometry/physics)
───────────────────────────────────────────────────────────── */
const VISUAL_CONFIG = {
  VECTOR_FIELD_DENSITY: 40,
  VECTOR_FIELD_RANGE: 3,
  VECTOR_MAX_SCALE: 1,
  VECTOR_BODY_COLOR: "#475569",
  VECTOR_HEAD_COLOR: "#64748b",
  VECTOR_OPACITY: 0.15,
  ARROW_BODY_LENGTH: 0.005,
  ARROW_BODY_THICKNESS: 0.01,
  ARROW_HEAD_RADIUS: 0.02,
  ARROW_HEAD_HEIGHT: 0.07,
  PARTICLE_RADIUS: 0.05,
  PARTICLE_NEW_COLOR: "#3ca7f4",
  PARTICLE_OLD_COLOR: "#de1e1e",
  PARTICLE_NEW_OPACITY: 1.0,
  PARTICLE_OLD_OPACITY: 1,
  PARTICLE_EMISSIVE_INTENSITY_NEW: 1,
  PARTICLE_EMISSIVE_INTENSITY_OLD: 1,
  PARTICLE_LERP_SPEED: 0.05,
  PARTICLE_SCALE_AMPLITUDE: 0.1,
  PARTICLE_SCALE_FREQUENCY: 5,
  PARTICLE_MIN_DISTANCE: 0.01,
  STABILITY_CIRCLE_RADIUS: 1,
  STABILITY_CIRCLE_THICKNESS: 0.01,
  STABILITY_CIRCLE_COLOR: "#ef4444",
  STABILITY_CIRCLE_OPACITY: 0.5,
  GRID_SIZE: 6,
  GRID_COLOR: "#1e293b",
  AXIS_LENGTH: 1,
  AXIS_THICKNESS: 0.01,
  AXIS_X_COLOR: "#ef4444",
  AXIS_Y_COLOR: "#22c55e",
  AXIS_Z_COLOR: "#3b82f6",
  AXIS_ARROW_SIZE: 0.03,
  AXIS_ARROW_HEIGHT: 0.07,
  AXIS_OPACITY: 1,
  MATRIX_VECTOR_THICKNESS: 0.01,
  MATRIX_VECTOR_1_COLOR: "#f59e0b",
  MATRIX_VECTOR_2_COLOR: "#8b5cf6",
  MATRIX_VECTOR_OPACITY: 1,
  MATRIX_ARROW_SIZE: 0.03,
  MATRIX_ARROW_HEIGHT: 0.07,
  EIGEN_VECTOR_THICKNESS: 0.015,
  EIGEN_VECTOR_1_COLOR: "#10b981",
  EIGEN_VECTOR_2_COLOR: "#f97316",
  EIGEN_VALUE_1_COLOR: "#06b6d4",
  EIGEN_VALUE_2_COLOR: "#ec4899",
  EIGEN_OPACITY: 0.9,
  EIGEN_ARROW_SIZE: 0.04,
  EIGEN_ARROW_HEIGHT: 0.1,
  RESERVOIR_STATE_RADIUS: 0.12,
  RESERVOIR_STATE_COLOR: "#e33bef",
  RESERVOIR_STATE_OPACITY: 0.9,
  RESERVOIR_STATE_EMISSIVE_INTENSITY: 2,
  INPUT_NOISE_AMPLITUDE: 1.0,
  INPUT_SCALE_FACTOR: 2.0,
  INPUT_POSITION_SCALE: 1.2
};

const INIT_WIN_VALUES = [1, 0, 0, 1];
const INIT_MATRIX_VALUES = ['0', '-1', '1', '0'];

/* ─────────────────────────────────────────────────────────────
   THEME SYSTEM
───────────────────────────────────────────────────────────── */
const themes = {
  dark: {
    bg: '#0A0F1E', panel: '#111827', surface: '#1E293B', surfaceHover: '#253347',
    border: '#1E3A5F', borderLight: '#1E293B', text: '#F1F5F9', textMuted: '#94A3B8',
    textDim: '#64748B', accent: '#06B6D4', accentHover: '#22D3EE', accentSoft: 'rgba(6,182,212,0.12)',
    danger: '#EF4444', success: '#10B981', warning: '#F59E0B', inputBg: '#0F172A',
    gridColor: '#1e293b', canvasBg: '#0A0F1E', toggleBg: '#1E293B', toggleThumb: '#06B6D4',
    checkboxAccent: '#06B6D4', badgeStable: 'rgba(16,185,129,0.15)', badgeStableText: '#10B981',
    badgeUnstable: 'rgba(239,68,68,0.15)', badgeUnstableText: '#EF4444',
    mono: '"JetBrains Mono", "Fira Code", monospace', sans: '"Inter", system-ui, sans-serif',
  },
  light: {
    bg: '#F0F4FF', panel: '#FFFFFF', surface: '#F1F5F9', surfaceHover: '#E2E8F0',
    border: '#CBD5E1', borderLight: '#E2E8F0', text: '#0F172A', textMuted: '#475569',
    textDim: '#94A3B8', accent: '#0284C7', accentHover: '#0369A1', accentSoft: 'rgba(2,132,199,0.08)',
    danger: '#DC2626', success: '#059669', warning: '#D97706', inputBg: '#F8FAFC',
    gridColor: '#CBD5E1', canvasBg: '#E8EFFE', toggleBg: '#E2E8F0', toggleThumb: '#0284C7',
    checkboxAccent: '#0284C7', badgeStable: 'rgba(5,150,105,0.12)', badgeStableText: '#059669',
    badgeUnstable: 'rgba(220,38,38,0.12)', badgeUnstableText: '#DC2626',
    mono: '"JetBrains Mono", "Fira Code", monospace', sans: '"Inter", system-ui, sans-serif',
  }
};

/* ─────────────────────────────────────────────────────────────
   3D COMPONENTS (unchanged logic)
───────────────────────────────────────────────────────────── */
const VectorField = ({ matrix, density = VISUAL_CONFIG.VECTOR_FIELD_DENSITY }) => {
  const arrows = useMemo(() => {
    const temp = [];
    const range = VISUAL_CONFIG.VECTOR_FIELD_RANGE;
    const step = (range * 2) / density;
    for (let x = -range; x <= range; x += step) {
      for (let y = -range; y <= range; y += step) {
        if (Math.abs(x) < 0.1 && Math.abs(y) < 0.1) continue;
        const nextX = matrix.a * x + matrix.b * y;
        const nextY = matrix.c * x + matrix.d * y;
        const dirX = nextX - x;
        const dirY = nextY - y;
        const length = Math.sqrt(dirX * dirX + dirY * dirY);
        const scale = Math.min(length, VISUAL_CONFIG.VECTOR_MAX_SCALE);
        const angle = Math.atan2(dirY, dirX);
        temp.push({ pos: [x, y, 0], angle, scale });
      }
    }
    return temp;
  }, [matrix, density]);

  return (
    <group position={[0, 0, -0.05]}>
      {arrows.map((arrow, i) => (
        <group key={i} position={arrow.pos} rotation={[0, 0, arrow.angle]}>
          <mesh position={[arrow.scale / 2, 0, 0]}>
            <boxGeometry args={[arrow.scale, VISUAL_CONFIG.ARROW_BODY_THICKNESS, VISUAL_CONFIG.ARROW_BODY_THICKNESS]} />
            <meshBasicMaterial color={VISUAL_CONFIG.VECTOR_BODY_COLOR} transparent opacity={VISUAL_CONFIG.VECTOR_OPACITY} />
          </mesh>
          <mesh position={[arrow.scale, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[VISUAL_CONFIG.ARROW_HEAD_RADIUS, VISUAL_CONFIG.ARROW_HEAD_HEIGHT, 4]} />
            <meshBasicMaterial color={VISUAL_CONFIG.VECTOR_HEAD_COLOR} transparent opacity={VISUAL_CONFIG.VECTOR_OPACITY} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const Particle = ({ data }) => {
  const mesh = useRef();
  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.position.x = THREE.MathUtils.lerp(mesh.current.position.x, data.x, VISUAL_CONFIG.PARTICLE_LERP_SPEED);
    mesh.current.position.y = THREE.MathUtils.lerp(mesh.current.position.y, data.y, VISUAL_CONFIG.PARTICLE_LERP_SPEED);
    const scale = 1 + Math.sin(state.clock.elapsedTime * VISUAL_CONFIG.PARTICLE_SCALE_FREQUENCY + data.id) * VISUAL_CONFIG.PARTICLE_SCALE_AMPLITUDE;
    mesh.current.scale.set(scale, scale, scale);
  });
  const color = data.isNew ? VISUAL_CONFIG.PARTICLE_NEW_COLOR : VISUAL_CONFIG.PARTICLE_OLD_COLOR;
  const emissiveIntensity = data.isNew ? VISUAL_CONFIG.PARTICLE_EMISSIVE_INTENSITY_NEW : VISUAL_CONFIG.PARTICLE_EMISSIVE_INTENSITY_OLD;
  return (
    <mesh ref={mesh} position={[data.prevX, data.prevY, 0]}>
      <sphereGeometry args={[VISUAL_CONFIG.PARTICLE_RADIUS, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissiveIntensity} transparent opacity={data.isNew ? VISUAL_CONFIG.PARTICLE_NEW_OPACITY : VISUAL_CONFIG.PARTICLE_OLD_OPACITY} />
      {data.isNew && <pointLight distance={1} intensity={2} color={VISUAL_CONFIG.PARTICLE_NEW_COLOR} />}
    </mesh>
  );
};

const ParticleSystem = ({ particles }) => (
  <group>{particles.map((p) => <Particle key={p.id} data={p} />)}</group>
);

const UnitCircle = () => (
  <group rotation={[Math.PI / 2, 0, 0]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[VISUAL_CONFIG.STABILITY_CIRCLE_RADIUS - VISUAL_CONFIG.STABILITY_CIRCLE_THICKNESS, VISUAL_CONFIG.STABILITY_CIRCLE_RADIUS + VISUAL_CONFIG.STABILITY_CIRCLE_THICKNESS, 128]} />
      <meshBasicMaterial color={VISUAL_CONFIG.STABILITY_CIRCLE_COLOR} transparent opacity={VISUAL_CONFIG.STABILITY_CIRCLE_OPACITY} side={THREE.DoubleSide} />
    </mesh>
  </group>
);

const CustomGrid = ({ color }) => (
  <primitive object={new THREE.GridHelper(VISUAL_CONFIG.GRID_SIZE, VISUAL_CONFIG.GRID_SIZE, color, color)} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />
);

const Axes = ({ showImaginaryAxis = true, showAxesXY = true }) => {
  const { AXIS_LENGTH: L, AXIS_THICKNESS: T, AXIS_ARROW_SIZE: AS, AXIS_ARROW_HEIGHT: AH, AXIS_OPACITY: AO } = VISUAL_CONFIG;
  return (
    <group>
      {showAxesXY && (
        <>
          <group>
            <mesh position={[L / 2, 0, 0]}><boxGeometry args={[L, T, T]} /><meshBasicMaterial color={VISUAL_CONFIG.AXIS_X_COLOR} transparent opacity={AO} /></mesh>
            <mesh position={[L - AH / 2 + 0.01, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[AS, AH, 8]} /><meshBasicMaterial color={VISUAL_CONFIG.AXIS_X_COLOR} transparent opacity={AO} /></mesh>
          </group>
          <group>
            <mesh position={[0, L / 2, 0]}><boxGeometry args={[T, L, T]} /><meshBasicMaterial color={VISUAL_CONFIG.AXIS_Y_COLOR} transparent opacity={AO} /></mesh>
            <mesh position={[0, L - AH / 2 + 0.01, 0]}><coneGeometry args={[AS, AH, 8]} /><meshBasicMaterial color={VISUAL_CONFIG.AXIS_Y_COLOR} transparent opacity={AO} /></mesh>
          </group>
        </>
      )}
      {showImaginaryAxis && (
        <group>
          <mesh position={[0, 0, L / 2]}><boxGeometry args={[T, T, L]} /><meshBasicMaterial color={VISUAL_CONFIG.AXIS_Z_COLOR} transparent opacity={AO} /></mesh>
          <mesh position={[0, 0, L - AH / 2 + 0.01]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[AS, AH, 8]} /><meshBasicMaterial color={VISUAL_CONFIG.AXIS_Z_COLOR} transparent opacity={AO} /></mesh>
        </group>
      )}
    </group>
  );
};

const MatrixVisualization = ({ matrix, showMatrixVectors }) => {
  const T = VISUAL_CONFIG.MATRIX_VECTOR_THICKNESS;
  const AS = VISUAL_CONFIG.MATRIX_ARROW_SIZE;
  const AH = VISUAL_CONFIG.MATRIX_ARROW_HEIGHT;
  const AO = VISUAL_CONFIG.MATRIX_VECTOR_OPACITY;
  const col1 = { x: matrix.a, y: matrix.c };
  const col1Length = Math.sqrt(col1.x ** 2 + col1.y ** 2);
  const col1Angle = Math.atan2(col1.y, col1.x);
  const col2 = { x: matrix.b, y: matrix.d };
  const col2Length = Math.sqrt(col2.x ** 2 + col2.y ** 2);
  const col2Angle = Math.atan2(col2.y, col2.x);
  if (!showMatrixVectors) return null;
  return (
    <group>
      {col1Length > 0.01 && (
        <group rotation={[0, 0, col1Angle]}>
          <mesh position={[col1Length / 2, 0, 0]}><boxGeometry args={[col1Length, T, T]} /><meshBasicMaterial color={VISUAL_CONFIG.MATRIX_VECTOR_1_COLOR} transparent opacity={AO} /></mesh>
          <mesh position={[col1Length, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[AS, AH, 8]} /><meshBasicMaterial color={VISUAL_CONFIG.MATRIX_VECTOR_1_COLOR} transparent opacity={AO} /></mesh>
        </group>
      )}
      {col2Length > 0.01 && (
        <group rotation={[0, 0, col2Angle]}>
          <mesh position={[col2Length / 2, 0, 0]}><boxGeometry args={[col2Length, T, T]} /><meshBasicMaterial color={VISUAL_CONFIG.MATRIX_VECTOR_2_COLOR} transparent opacity={AO} /></mesh>
          <mesh position={[col2Length, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[AS, AH, 8]} /><meshBasicMaterial color={VISUAL_CONFIG.MATRIX_VECTOR_2_COLOR} transparent opacity={AO} /></mesh>
        </group>
      )}
    </group>
  );
};

const ReservoirState = ({ x, y }) => {
  const mesh = useRef();
  useFrame(() => {
    if (!mesh.current) return;
    const scale = 1 + Math.sin(Date.now() * 0.003) * 0.2;
    mesh.current.scale.set(scale, scale, scale);
  });
  return (
    <mesh ref={mesh} position={[x, y, 0]}>
      <sphereGeometry args={[VISUAL_CONFIG.RESERVOIR_STATE_RADIUS, 16, 16]} />
      <meshStandardMaterial color={VISUAL_CONFIG.RESERVOIR_STATE_COLOR} emissive={VISUAL_CONFIG.RESERVOIR_STATE_COLOR} emissiveIntensity={VISUAL_CONFIG.RESERVOIR_STATE_EMISSIVE_INTENSITY} transparent opacity={VISUAL_CONFIG.RESERVOIR_STATE_OPACITY} />
      <pointLight distance={2} intensity={3} color={VISUAL_CONFIG.RESERVOIR_STATE_COLOR} />
    </mesh>
  );
};

const EigenVisualization = ({ eigenAnalysis, showEigenvalues, showEigenvectors }) => {
  const T = VISUAL_CONFIG.EIGEN_VECTOR_THICKNESS;
  const AS = VISUAL_CONFIG.EIGEN_ARROW_SIZE;
  const AH = VISUAL_CONFIG.EIGEN_ARROW_HEIGHT;

  const createComplexVector = (c, scale = 1) => {
    if (!c) return { x: 0, y: 0, z: 0, length: 0 };
    const real = isNaN(c.real) ? (isNaN(c) ? 0 : Number(c) || 0) : Number(c.real) || 0;
    const imag = isNaN(c.imag) ? 0 : Number(c.imag) || 0;
    const s = isNaN(scale) ? 1 : Number(scale) || 1;
    const x = real * s, z = imag * s;
    const length = Math.sqrt(real ** 2 + imag ** 2) * s;
    return { x: isNaN(x) ? 0 : x, y: 0, z: isNaN(z) ? 0 : z, length: isNaN(length) ? 0 : length };
  };

  const createEigenVector = (ev, scale = 1) => {
    if (!ev?.x || !ev?.y) return { x: 0, y: 0, z: 0, length: 0 };
    const s = isNaN(scale) ? 1 : Number(scale) || 1;
    const xR = (isNaN(ev.x.real) ? 0 : Number(ev.x.real) || 0) * s;
    const xI = (isNaN(ev.x.imag) ? 0 : Number(ev.x.imag) || 0) * s;
    const yR = (isNaN(ev.y.real) ? 0 : Number(ev.y.real) || 0) * s;
    const yI = (isNaN(ev.y.imag) ? 0 : Number(ev.y.imag) || 0) * s;
    const z = isNaN(xI + yI) ? 0 : xI + yI;
    const length = Math.sqrt(xR ** 2 + yR ** 2 + z ** 2);
    return { x: isNaN(xR) ? 0 : xR, y: isNaN(yR) ? 0 : yR, z, length: isNaN(length) ? 0 : length };
  };

  const Arrow3D = ({ start, end, color, thickness: t }) => {
    if (!start || !end) return null;
    const { length, midPoint, quaternion } = useMemo(() => {
      const sv = new THREE.Vector3(start.x, start.y, start.z);
      const ev = new THREE.Vector3(end.x, end.y, end.z);
      const dir = new THREE.Vector3().subVectors(ev, sv);
      const len = dir.length();
      if (len < 0.001) return { length: 0, midPoint: [0, 0, 0], quaternion: new THREE.Quaternion() };
      const mid = new THREE.Vector3().addVectors(sv, ev).multiplyScalar(0.5);
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      return { length: len, midPoint: [mid.x, mid.y, mid.z], quaternion: quat };
    }, [start, end]);
    if (length < 0.01) return null;
    return (
      <group>
        <mesh position={midPoint} quaternion={quaternion}><cylinderGeometry args={[t / 2, t / 2, length, 8]} /><meshBasicMaterial color={color} transparent opacity={0.6} /></mesh>
        <mesh position={[end.x, end.y, end.z]} quaternion={quaternion}><coneGeometry args={[AS, AH, 8]} /><meshBasicMaterial color={color} transparent opacity={VISUAL_CONFIG.EIGEN_OPACITY} /></mesh>
      </group>
    );
  };

  const ev1Vec = createComplexVector(eigenAnalysis.eigenvalue1);
  const ev2Vec = createComplexVector(eigenAnalysis.eigenvalue2);
  const evec1 = createEigenVector(eigenAnalysis.eigenvector1);
  const evec2 = createEigenVector(eigenAnalysis.eigenvector2);
  const O = { x: 0, y: 0, z: 0 };

  return (
    <group>
      {showEigenvalues && (
        <>
          <Arrow3D start={O} end={ev1Vec} color={VISUAL_CONFIG.EIGEN_VALUE_1_COLOR} thickness={T / 2} />
          <Arrow3D start={O} end={ev2Vec} color={VISUAL_CONFIG.EIGEN_VALUE_2_COLOR} thickness={T / 2} />
        </>
      )}
      {showEigenvectors && (
        <>
          <Arrow3D start={O} end={evec1} color={VISUAL_CONFIG.EIGEN_VECTOR_1_COLOR} thickness={T} />
          <Arrow3D start={O} end={evec2} color={VISUAL_CONFIG.EIGEN_VECTOR_2_COLOR} thickness={T} />
        </>
      )}
    </group>
  );
};

/* ─────────────────────────────────────────────────────────────
   UI SUBCOMPONENTS
───────────────────────────────────────────────────────────── */
const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const MatrixInput = ({ label, value, onChange, t }) => {
  // 🔹 MODIFICATION : Fonction pour gérer le +0.05 / -0.05
  const handleStep = (step) => {
    // 1. On lit la valeur courante (en gérant la virgule)
    const currentVal = parseFloat(String(value).replace(',', '.'));
    const num = isNaN(currentVal) ? 0 : currentVal;
    
    // 2. On fait le calcul, et on force 2 décimales pour éviter les bugs JavaScript (ex: 0.15000000002)
    const newVal = (num + step).toFixed(2);
    
    // 3. Number(newVal) enlève les zéros inutiles à la fin, String() le convertit pour le state
    onChange(String(Number(newVal)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, fontFamily: t.mono, color: t.textDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</label>
      
      {/* 🔹 MODIFICATION : Conteneur relatif pour placer les boutons pardessus l'input */}
      <div style={{ position: 'relative', display: 'flex' }}>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            background: t.inputBg,
            border: `1px solid ${t.border}`,
            borderRadius: 6,
            padding: '6px 20px 6px 8px', // Espace à droite augmenté (20px) pour ne pas cacher le texte sous les boutons
            fontSize: 13,
            fontFamily: t.mono,
            color: t.text,
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
        />
        
        {/* Colonne des boutons Up/Down */}
        <div style={{ 
          position: 'absolute', 
          right: 2, 
          top: 2, 
          bottom: 2, 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center',
          width: 16
        }}>
          <button 
            onClick={() => handleStep(0.05)}
            style={{ flex: 1, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: t.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="+0.05"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button 
            onClick={() => handleStep(-0.05)}
            style={{ flex: 1, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: t.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="-0.05"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

const Toggle = ({ checked, onChange, t }) => (
  <div
    onClick={() => onChange(!checked)}
    style={{
      position: 'relative', width: 36, height: 20, background: checked ? t.accent : t.toggleBg,
      borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s',
      border: `1px solid ${checked ? t.accent : t.border}`, flexShrink: 0,
    }}
  >
    <div style={{
      position: 'absolute', top: 2, left: checked ? 17 : 2, width: 14, height: 14,
      background: checked ? '#fff' : t.textDim, borderRadius: '50%', transition: 'left 0.2s',
    }} />
  </div>
);

const Divider = ({ t }) => (
  <div style={{ height: 1, background: t.borderLight, margin: '2px 0' }} />
);

const Badge = ({ children, color, bg }) => (
  <span style={{
    background: bg, color, fontSize: 10, fontWeight: 600, padding: '2px 8px',
    borderRadius: 20, letterSpacing: '0.05em', textTransform: 'uppercase',
  }}>{children}</span>
);

const Section = ({ title, children, t }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontSize: 10, fontFamily: t.mono, color: t.accent, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
      {title}
    </div>
    {children}
  </div>
);

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
export default function ReservoirLinearViz() {
  const [isDark, setIsDark] = useState(true);
  const t = themes[isDark ? 'dark' : 'light'];

  const [matrixValues, setMatrixValues] = useState(INIT_MATRIX_VALUES);
  const [particles, setParticles] = useState([]);
  const [stepCount, setStepCount] = useState(0);

  const [showImaginaryAxis, setShowImaginaryAxis] = useState(false);
  const [showEigenvalues, setShowEigenvalues] = useState(false);
  const [showEigenvectors, setShowEigenvectors] = useState(false);
  const [showMatrixVectors, setShowMatrixVectors] = useState(true);
  const [showAxesXY, setShowAxesXY] = useState(true);
  const [showReservoirState, setShowReservoirState] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const parseVal = useCallback((val) => {
    const parsed = parseFloat(String(val).replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  }, []);

  const W = useMemo(() => ({
    a: parseVal(matrixValues[0]), 
    b: parseVal(matrixValues[1]), 
    c: parseVal(matrixValues[2]), 
    d: parseVal(matrixValues[3])
  }), [matrixValues, parseVal]);

  const updateMatrixValue = useCallback((index, value) => {
    setMatrixValues(prev => { 
      const n = [...prev]; 
      n[index] = value; 
      return n; 
    });
  }, []);

  const eigenAnalysis = useMemo(() => {
    const { a, b, c, d } = W; 
    const trace = a + d, det = a * d - b * c;
    const disc = trace * trace - 4 * det;
    if (isNaN(trace) || isNaN(det) || isNaN(disc)) {
      return { eigenvalue1: { real: 0, imag: 0 }, eigenvalue2: { real: 0, imag: 0 }, eigenvector1: { x: { real: 1, imag: 0 }, y: { real: 0, imag: 0 } }, eigenvector2: { x: { real: 0, imag: 0 }, y: { real: 1, imag: 0 } }, isComplex: false, spectralRadius: 0 };
    }
    let ev1, ev2, evec1, evec2, isComplex = false;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      ev1 = (trace + sq) / 2; ev2 = (trace - sq) / 2;
      if (Math.abs(b) > 1e-10) {
        evec1 = { x: 1, y: (ev1 - a) / b }; evec2 = { x: 1, y: (ev2 - a) / b };
      } else if (Math.abs(c) > 1e-10) {
        evec1 = { x: (ev1 - d) / c, y: 1 }; evec2 = { x: (ev2 - d) / c, y: 1 };
      } else { evec1 = { x: 1, y: 0 }; evec2 = { x: 0, y: 1 }; }
      const n1 = Math.sqrt(evec1.x ** 2 + evec1.y ** 2), n2 = Math.sqrt(evec2.x ** 2 + evec2.y ** 2);
      if (n1 > 1e-10) { evec1.x /= n1; evec1.y /= n1; }
      if (n2 > 1e-10) { evec2.x /= n2; evec2.y /= n2; }
      evec1 = { x: { real: evec1.x, imag: 0 }, y: { real: evec1.y, imag: 0 } };
      evec2 = { x: { real: evec2.x, imag: 0 }, y: { real: evec2.y, imag: 0 } };
    } else {
      isComplex = true;
      const rP = trace / 2, iP = Math.sqrt(-disc) / 2;
      ev1 = { real: rP, imag: iP }; ev2 = { real: rP, imag: -iP };
      if (Math.abs(b) > 1e-10) {
        evec1 = { x: { real: 1, imag: 0 }, y: { real: (rP - a) / b, imag: iP / b } };
        evec2 = { x: { real: 1, imag: 0 }, y: { real: (rP - a) / b, imag: -iP / b } };
      } else if (Math.abs(c) > 1e-10) {
        evec1 = { x: { real: (rP - d) / c, imag: iP / c }, y: { real: 1, imag: 0 } };
        evec2 = { x: { real: (rP - d) / c, imag: -iP / c }, y: { real: 1, imag: 0 } };
      } else {
        evec1 = { x: { real: 1, imag: 0 }, y: { real: 0, imag: 0 } };
        evec2 = { x: { real: 0, imag: 0 }, y: { real: 1, imag: 0 } };
      }
    }
    const sr = isComplex
      ? Math.sqrt((ev1.real || 0) ** 2 + (ev1.imag || 0) ** 2)
      : Math.max(Math.abs(ev1 || 0), Math.abs(ev2 || 0));
    return { eigenvalue1: ev1, eigenvalue2: ev2, eigenvector1: evec1, eigenvector2: evec2, isComplex, spectralRadius: isNaN(sr) ? 0 : sr };
  }, [W]); 

  const handleStep = useCallback((injectInput = false) => {
    setParticles(prev => {
      const next = prev.map(p => {
        const nx = W.a * p.x + W.b * p.y, ny = W.c * p.x + W.d * p.y;
        return { ...p, prevX: p.x, prevY: p.y, x: nx, y: ny, isNew: false, age: p.age + 1 };
      }).filter(p => Math.sqrt(p.x ** 2 + p.y ** 2) > VISUAL_CONFIG.PARTICLE_MIN_DISTANCE);
      if (injectInput) {
        const xi = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
        const nx = xi.x * INIT_WIN_VALUES[0] + xi.y * INIT_WIN_VALUES[1];
        const ny = xi.x * INIT_WIN_VALUES[2] + xi.y * INIT_WIN_VALUES[3];
        next.push({ id: Date.now() + Math.random(), prevX: nx * VISUAL_CONFIG.INPUT_POSITION_SCALE, prevY: ny * VISUAL_CONFIG.INPUT_POSITION_SCALE, x: nx, y: ny, isNew: true, age: 0 });
      }
      return next;
    });
    setStepCount(c => c + 1);
  }, [W]);

  const handleReset = useCallback(() => { setParticles([]); setStepCount(0); }, []);

  const reservoirState = useMemo(() => {
    let sx = 0, sy = 0;
    particles.forEach(p => { sx += p.x; sy += p.y; });
    return { x: sx, y: sy };
  }, [particles]);

  const isStable = eigenAnalysis.spectralRadius < 1;
  
  const trace = W.a + W.d;
  const det = W.a * W.d - W.b * W.c;

  const fmtComplex = (real, imag) => {
    if (isNaN(real) && isNaN(imag)) return '0.000';
    const r = isNaN(real) ? 0 : real;
    const i = isNaN(imag) ? 0 : imag;
    if (Math.abs(i) < 1e-10) return r.toFixed(3);
    return `${r.toFixed(2)}${i >= 0 ? '+' : ''}${i.toFixed(2)}i`;
  };

  const getEVDisplay = (ev) => {
    if (typeof ev === 'object' && ev !== null && 'real' in ev) return fmtComplex(ev.real, ev.imag);
    return isNaN(ev) ? '0.000' : Number(ev).toFixed(3);
  };

  /* ── Display toggles config ── */
  const displayToggles = [
    { key: 'axesXY', label: 'Axes réels (X, Y)', color: '#ef4444', value: showAxesXY, setter: setShowAxesXY },
    { key: 'imagAxis', label: 'Axe imaginaire (Z)', color: '#3b82f6', value: showImaginaryAxis, setter: setShowImaginaryAxis },
    { key: 'matVecs', label: 'Colonnes W', color: '#f59e0b', value: showMatrixVectors, setter: setShowMatrixVectors },
    { key: 'eigenVals', label: 'Valeurs propres λ', color: '#06b6d4', value: showEigenvalues, setter: setShowEigenvalues },
    { key: 'eigenVecs', label: 'Vecteurs propres v', color: '#10b981', value: showEigenvectors, setter: setShowEigenvectors },
    { key: 'resvState', label: 'État réservoir ∑', color: '#ef4444', value: showReservoirState, setter: setShowReservoirState },
  ];

  /* ── Styles ── */
  const panelStyle = {
    background: t.panel, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: 0,
    overflowY: 'auto', width: sidebarOpen ? 310 : 0, minWidth: sidebarOpen ? 310 : 0,
    transition: 'width 0.25s ease, min-width 0.25s ease', overflow: 'scroll',
  };

  const panelInner = {
    width: 280, minWidth: 280, padding: '16px 16px 20px', display: 'flex', flexDirection: 'column',
    gap: 20, fontFamily: t.sans,
  };

  return (
    <div style={{ width: '100%', height: '100vh', background: t.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: t.sans }}>

      {/* ── TOP BAR ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
        height: 48, background: t.panel, borderBottom: `1px solid ${t.border}`, flexShrink: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 4, display: 'flex', alignItems: 'center', borderRadius: 4 }}
            title="Toggle sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: t.text, letterSpacing: '-0.01em' }}>Reservoir Linéaire</span>
          <span style={{ fontSize: 11, color: t.textDim, fontFamily: t.mono }}>x[n+1] = W·x[n] + W_in·u[n]</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontFamily: t.mono, color: t.textDim }}>t = {stepCount}</span>
          <Badge color={isStable ? t.badgeStableText : t.badgeUnstableText} bg={isStable ? t.badgeStable : t.badgeUnstable}>
            {isStable ? 'stable' : 'instable'}
          </Badge>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: t.textDim, display: 'flex' }}><MoonIcon /></span>
            <Toggle checked={!isDark} onChange={v => setIsDark(!v)} t={t} />
            <span style={{ color: t.textDim, display: 'flex' }}><SunIcon /></span>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── SIDEBAR ── */}
        <div style={panelStyle}>
          <div style={panelInner}>

            {/* Actions */}
            <Section title="Contrôles" t={t}>
              <button
                onClick={() => handleStep(true)}
                style={{
                  background: t.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.15s',
                  letterSpacing: '0.01em',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
                Injecter signal u(n)
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={() => handleStep(false)}
                  style={{
                    background: t.surface, color: t.text, border: `1px solid ${t.border}`, borderRadius: 8,
                    padding: '8px 0', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'background 0.15s',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Step
                </button>
                <button
                  onClick={handleReset}
                  style={{
                    background: t.surface, color: t.danger, border: `1px solid ${t.border}`, borderRadius: 8,
                    padding: '8px 0', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'background 0.15s',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5"/></svg>
                  Reset
                </button>
              </div>
            </Section>

            <Divider t={t} />

            {/* Matrix W */}
            <Section title="Matrice W (2×2)" t={t}>
              <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
                {/* Visual matrix bracket */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <div style={{ width: 3, height: 52, borderTop: `2px solid ${t.border}`, borderLeft: `2px solid ${t.border}`, borderBottom: `2px solid ${t.border}`, borderRadius: '3px 0 0 3px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {[
                        { label: 'W₁₁', index: 0 }, { label: 'W₁₂', index: 1 },
                        { label: 'W₂₁', index: 2 }, { label: 'W₂₂', index: 3 },
                      ].map(({ label, index }) => (
                        <MatrixInput key={index} label={label} value={matrixValues[index]} onChange={v => updateMatrixValue(index, v)} t={t} />
                      ))}
                    </div>
                  </div>
                  <div style={{ width: 3, height: 52, borderTop: `2px solid ${t.border}`, borderRight: `2px solid ${t.border}`, borderBottom: `2px solid ${t.border}`, borderRadius: '0 3px 3px 0' }} />
                </div>

                {/* Stats row */}
                <div style={{ borderTop: `1px solid ${t.borderLight}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {[
                    { label: 'Trace', value: isNaN(trace) ? '—' : trace.toFixed(3) },
                    { label: 'Det', value: isNaN(det) ? '—' : det.toFixed(3) },
                    { label: 'Rayon spectral', value: isNaN(eigenAnalysis.spectralRadius) ? '—' : eigenAnalysis.spectralRadius.toFixed(3), highlight: true },
                  ].map(({ label, value, highlight }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: t.textDim, fontFamily: t.mono }}>{label}</span>
                      <span style={{ fontSize: 12, fontFamily: t.mono, fontWeight: 600, color: highlight ? (isStable ? t.success : t.danger) : t.textMuted }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            <Divider t={t} />

            {/* Eigenvalues */}
            <Section title="Analyse spectrale" t={t}>
              <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: t.textDim, fontFamily: t.mono, marginBottom: 4, letterSpacing: '0.06em' }}>VALEURS PROPRES</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {[
                      { label: 'λ₁', color: VISUAL_CONFIG.EIGEN_VALUE_1_COLOR, val: eigenAnalysis.eigenvalue1 },
                      { label: 'λ₂', color: VISUAL_CONFIG.EIGEN_VALUE_2_COLOR, val: eigenAnalysis.eigenvalue2 },
                    ].map(({ label, color, val }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color, fontFamily: t.mono, fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 11, fontFamily: t.mono, color: t.textMuted }}>{getEVDisplay(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${t.borderLight}`, paddingTop: 8 }}>
                  <div style={{ fontSize: 10, color: t.textDim, fontFamily: t.mono, marginBottom: 4, letterSpacing: '0.06em' }}>VECTEURS PROPRES</div>
                  {[
                    { label: 'v₁', color: VISUAL_CONFIG.EIGEN_VECTOR_1_COLOR, v: eigenAnalysis.eigenvector1 },
                    { label: 'v₂', color: VISUAL_CONFIG.EIGEN_VECTOR_2_COLOR, v: eigenAnalysis.eigenvector2 },
                  ].map(({ label, color, v }) => {
                    const xR = v?.x?.real || 0, xI = v?.x?.imag || 0;
                    const yR = v?.y?.real || 0, yI = v?.y?.imag || 0;
                    return (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                        <span style={{ fontSize: 12, color, fontFamily: t.mono, fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 10, fontFamily: t.mono, color: t.textMuted, textAlign: 'right' }}>
                          [{fmtComplex(xR, xI)},<br />{fmtComplex(yR, yI)}]
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Section>

            <Divider t={t} />

            {/* Display toggles */}
            <Section title="Affichage 3D" t={t}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {displayToggles.map(({ key, label, color, value, setter }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: t.textMuted }}>{label}</span>
                    </div>
                    <Toggle checked={value} onChange={setter} t={t} />
                  </div>
                ))}
              </div>
            </Section>

          </div>
        </div>

        {/* ── 3D CANVAS ── */}
        <div style={{ flex: 1, position: 'relative', cursor: 'move' }}>
          <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
            <color attach="background" args={[t.canvasBg]} />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <CustomGrid color={t.gridColor} />
            <Axes showImaginaryAxis={showImaginaryAxis} showAxesXY={showAxesXY} />
            <MatrixVisualization matrix={W} showMatrixVectors={showMatrixVectors} />
            <EigenVisualization eigenAnalysis={eigenAnalysis} showEigenvalues={showEigenvalues} showEigenvectors={showEigenvectors} />
            <VectorField matrix={W} />
            <UnitCircle />
            <ParticleSystem particles={particles} />
            {showReservoirState && particles.length > 0 && <ReservoirState x={reservoirState.x} y={reservoirState.y} />}
            <OrbitControls enablePan enableZoom enableRotate minPolarAngle={-Math.PI} maxPolarAngle={Math.PI} minAzimuthAngle={0} maxAzimuthAngle={0} />
          </Canvas>

          {/* ── CANVAS OVERLAY: particle count + legend ── */}
          <div style={{
            position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column',
            gap: 6, pointerEvents: 'none',
          }}>
            <div style={{
              background: isDark ? 'rgba(10,15,30,0.75)' : 'rgba(255,255,255,0.8)',
              backdropFilter: 'blur(4px)', border: `1px solid ${t.border}`, borderRadius: 8,
              padding: '8px 12px', fontSize: 11, fontFamily: t.mono, color: t.textMuted,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: VISUAL_CONFIG.PARTICLE_NEW_COLOR }} />
                <span>Signal injecté</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: VISUAL_CONFIG.PARTICLE_OLD_COLOR }} />
                <span>État précédent</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: VISUAL_CONFIG.RESERVOIR_STATE_COLOR }} />
                <span>État global ∑</span>
              </div>
              <div style={{ borderTop: `1px solid ${t.borderLight}`, paddingTop: 4, marginTop: 2 }}>
                <span style={{ color: t.accent }}>{particles.length}</span> particule{particles.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* ── CANVAS OVERLAY: orbit hint ── */}
          {!sidebarOpen && (
            <div style={{
              position: 'absolute', top: 12, left: 12, background: isDark ? 'rgba(10,15,30,0.75)' : 'rgba(255,255,255,0.8)',
              backdropFilter: 'blur(4px)', border: `1px solid ${t.border}`, borderRadius: 8, padding: '6px 10px',
              fontSize: 11, fontFamily: t.mono, color: t.textDim, pointerEvents: 'none',
            }}>
              t = {stepCount} · ρ = {eigenAnalysis.spectralRadius.toFixed(3)} · {isStable ? '✓ stable' : '⚠ instable'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}