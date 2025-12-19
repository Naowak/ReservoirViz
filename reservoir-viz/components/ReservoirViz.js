'use client';

import React, { useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * --- MATHS DU RESERVOIR ---
 * Simulation d'un système dynamique linéaire discret : x[n+1] = W * x[n] + Win * u[n]
 */

const generateMatrix = (rho, theta) => {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return {
    a: rho * cos, b: -rho * sin,
    c: rho * sin, d: rho * cos
  };
};

const WIN_VECTOR = { x: 0, y: 3 };

/**
 * --- COMPOSANTS 3D ---
 */

// 1. Le Champ de Vecteurs
const VectorField = ({ matrix, density = 12 }) => {
  const arrows = useMemo(() => {
    const temp = [];
    const range = 4;
    const step = (range * 2) / density;

    for (let x = -range; x <= range; x += step) {
      for (let y = -range; y <= range; y += step) {
        if (Math.abs(x) < 0.1 && Math.abs(y) < 0.1) continue;

        const nextX = matrix.a * x + matrix.b * y;
        const nextY = matrix.c * x + matrix.d * y;

        const dirX = nextX - x;
        const dirY = nextY - y;
        
        const length = Math.sqrt(dirX * dirX + dirY * dirY);
        const scale = Math.min(length, 0.8);
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
            {/* Corps de la flèche */}
            <mesh position={[arrow.scale / 2, 0, 0]}>
                <boxGeometry args={[arrow.scale, 0.05, 0.01]} />
                <meshBasicMaterial color="#475569" transparent opacity={0.4} />
            </mesh>
            {/* Tête de la flèche */}
            <mesh position={[arrow.scale, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[0.08, 0.2, 4]} />
                <meshBasicMaterial color="#64748b" transparent opacity={0.6} />
            </mesh>
        </group>
      ))}
    </group>
  );
};

// 2. Les Particules
const ParticleSystem = ({ particles }) => {
  return (
    <group>
      {particles.map((p) => (
        <Particle key={p.id} data={p} />
      ))}
    </group>
  );
};

const Particle = ({ data }) => {
  const mesh = useRef();
  
  useFrame((state) => {
    if (!mesh.current) return;
    
    // Interpolation fluide (LERP)
    mesh.current.position.x = THREE.MathUtils.lerp(mesh.current.position.x, data.x, 0.1);
    mesh.current.position.y = THREE.MathUtils.lerp(mesh.current.position.y, data.y, 0.1);
    
    const scale = 1 + Math.sin(state.clock.elapsedTime * 5 + data.id) * 0.1;
    mesh.current.scale.set(scale, scale, scale);
  });

  const color = data.isNew ? "#22d3ee" : "#818cf8";
  const opacity = data.isNew ? 1 : 0.6;

  return (
    <mesh ref={mesh} position={[data.prevX, data.prevY, 0]}>
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshStandardMaterial 
        color={color} 
        emissive={color}
        emissiveIntensity={data.isNew ? 2 : 0.5}
        transparent 
        opacity={opacity} 
      />
      {data.isNew && <pointLight distance={1} intensity={2} color="#22d3ee" />}
    </mesh>
  );
};

// 3. Cercle Unitaire (Limite de stabilité)
const UnitCircle = () => {
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.98, 3.02, 64]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
    </group>
  )
}

// 4. Grille Personnalisée (Remplacement de Drei Grid)
const CustomGrid = () => {
  return <primitive object={new THREE.GridHelper(10, 10, "#1e293b", "#1e293b")} position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]} />
}

/**
 * --- COMPOSANT PRINCIPAL ---
 */
export default function ReservoirLinearViz() {
  const [rho, setRho] = useState(0.85);
  const [theta, setTheta] = useState(Math.PI / 6);
  const [particles, setParticles] = useState([]);
  const [stepCount, setStepCount] = useState(0);

  const W = useMemo(() => generateMatrix(rho, theta), [rho, theta]);

  const handleStep = (injectInput = false) => {
    setParticles(prev => {
      const nextParticles = prev.map(p => {
        const nextX = W.a * p.x + W.b * p.y;
        const nextY = W.c * p.x + W.d * p.y;
        return {
          ...p,
          prevX: p.x,
          prevY: p.y,
          x: nextX,
          y: nextY,
          isNew: false,
          age: p.age + 1
        };
      }).filter(p => {
        return Math.sqrt(p.x*p.x + p.y*p.y) > 0.05;
      });

      if (injectInput) {
        const angleNoise = (Math.random() - 0.5) * 1.0; 
        const newX = WIN_VECTOR.x + Math.sin(angleNoise) * 2;
        const newY = WIN_VECTOR.y + Math.cos(angleNoise) * 2;

        nextParticles.push({
          id: Date.now() + Math.random(),
          prevX: newX * 1.2,
          prevY: newY * 1.2,
          x: newX,
          y: newY,
          isNew: true,
          age: 0
        });
      }

      return nextParticles;
    });
    setStepCount(c => c + 1);
  };

  const handleReset = () => {
    setParticles([]);
    setStepCount(0);
  };

  return (
    <div className="w-full h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row font-sans overflow-hidden">
      
      {/* -- UI -- */}
      <div className="w-full md:w-80 bg-slate-800/90 backdrop-blur border-r border-slate-700 p-6 flex flex-col gap-6 z-10 shadow-2xl overflow-y-auto">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
            Reservoir 2D
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Visualisation dynamique Echo State Network.
          </p>
        </div>

        <div className="flex flex-col gap-4 bg-slate-700/50 p-4 rounded-xl">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">État : t = {stepCount}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
             <button 
                onClick={() => handleStep(true)}
                className="col-span-2 flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-lg transition-all active:scale-95 font-medium shadow-lg shadow-cyan-900/20"
             >
                <span>➜</span> Injecter (u)
             </button>
             <button 
                onClick={() => handleStep(false)}
                className="flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-500 text-white py-2 rounded-lg transition-all"
             >
                <span>▶</span> Step
             </button>
             <button 
                onClick={handleReset}
                className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-red-500/80 text-white py-2 rounded-lg transition-all"
             >
                <span>↺</span> Reset
             </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Rayon Spectral (ρ)</label>
              <span className="font-mono text-cyan-400">{rho.toFixed(2)}</span>
            </div>
            <input 
              type="range" min="0.5" max="0.99" step="0.01" 
              value={rho} 
              onChange={(e) => setRho(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <label>Rotation (θ)</label>
              <span className="font-mono text-purple-400">{(theta * 180 / Math.PI).toFixed(0)}°</span>
            </div>
            <input 
              type="range" min="0" max="1.57" step="0.1" 
              value={theta} 
              onChange={(e) => setTheta(parseFloat(e.target.value))}
              className="w-full accent-purple-400 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <div className="mt-auto bg-blue-900/20 border border-blue-500/30 p-3 rounded text-xs text-blue-200 flex gap-2">
          <span className="text-xl">ℹ️</span>
          <p>
            Les flèches sont le champ <b>W</b>. Les points sont les états <b>x(t)</b> attirés par le centre.
          </p>
        </div>
      </div>

      {/* -- 3D -- */}
      <div className="flex-1 relative cursor-move">
        <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
          <color attach="background" args={['#0f172a']} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          
          <CustomGrid />
          <VectorField matrix={W} />
          <UnitCircle />
          <ParticleSystem particles={particles} />

          <OrbitControls 
            enablePan={true} 
            enableZoom={true} 
            enableRotate={true}
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2.5}
          />
        </Canvas>
        
        {/* Overlay HTML pour remplacer le texte 3D */}
        <div className="absolute top-4 right-4 text-right pointer-events-none select-none">
             <div className="text-red-500 font-bold opacity-50 text-xs uppercase tracking-widest mb-1">Limite de Stabilité</div>
             <div className="text-slate-500 font-mono text-sm">x[n+1] = W·x[n] + Win·u[n]</div>
        </div>
      </div>
    </div>
  );
}