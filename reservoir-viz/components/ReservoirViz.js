'use client';

import React, { useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * --- CONSTANTES VISUELLES ---
 */
const VISUAL_CONFIG = {
  // Champ de vecteurs
  VECTOR_FIELD_DENSITY: 40,
  VECTOR_FIELD_RANGE: 3,
  VECTOR_MAX_SCALE: 1,
  VECTOR_BODY_COLOR: "#475569",
  VECTOR_HEAD_COLOR: "#64748b",
  VECTOR_OPACITY: 0.3,
  ARROW_BODY_LENGTH: 0.005,
  ARROW_BODY_THICKNESS: 0.01,
  ARROW_HEAD_RADIUS: 0.02,
  ARROW_HEAD_HEIGHT: 0.07,
  
  // Particules
  PARTICLE_RADIUS: 0.05,
  PARTICLE_NEW_COLOR: "#22d3ee",
  PARTICLE_OLD_COLOR: "#818cf8",
  PARTICLE_NEW_OPACITY: 1.0,
  PARTICLE_OLD_OPACITY: 1,
  PARTICLE_EMISSIVE_INTENSITY_NEW: 1.5,
  PARTICLE_EMISSIVE_INTENSITY_OLD: 0.75,
  PARTICLE_LERP_SPEED: 0.05,
  PARTICLE_SCALE_AMPLITUDE: 0.1,
  PARTICLE_SCALE_FREQUENCY: 5,
  PARTICLE_MIN_DISTANCE: 0.01,
  
  // Cercle de stabilité
  STABILITY_CIRCLE_RADIUS: 1,
  STABILITY_CIRCLE_THICKNESS: 0.01,
  STABILITY_CIRCLE_COLOR: "#ef4444",
  STABILITY_CIRCLE_OPACITY: 0.3,
  
  // Grille
  GRID_SIZE: 6,
  GRID_COLOR: "#1e293b",
  
  // Axes
  AXIS_LENGTH: 1,
  AXIS_THICKNESS: 0.01,
  AXIS_X_COLOR: "#ef4444", // Rouge pour X
  AXIS_Y_COLOR: "#22c55e", // Vert pour Y
  AXIS_ARROW_SIZE: 0.03,
  AXIS_ARROW_HEIGHT: 0.07,
  AXIS_OPACITY: 1,
  
  // Visualisation de la matrice W
  MATRIX_VECTOR_THICKNESS: 0.01,
  MATRIX_VECTOR_1_COLOR: "#f59e0b", // Orange pour la première colonne
  MATRIX_VECTOR_2_COLOR: "#8b5cf6", // Violet pour la deuxième colonne
  MATRIX_VECTOR_OPACITY: 1,
  MATRIX_ARROW_SIZE: 0.03,
  MATRIX_ARROW_HEIGHT: 0.07,
  
  // Animation
  ANIMATION_SPEED_MULTIPLIER: 1.0,
  
  // Input injection
  INPUT_NOISE_AMPLITUDE: 1.0,
  INPUT_SCALE_FACTOR: 2.0,
  INPUT_POSITION_SCALE: 1.2
};

/**
 * --- MATHS DU RESERVOIR ---
 * Simulation d'un système dynamique linéaire discret : x[n+1] = W * x[n] + Win * u[n]
*/
const INIT_WIN_VALUES = [1, 0, 0, 1];
const INIT_MATRIX_VALUES = [0.9, 0.3, -0.3, 0.9]; // Matrice identité scaled

/**
 * --- COMPOSANTS 3D ---
 */

// 1. Le Champ de Vecteurs
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
            {/* Corps de la flèche */}
            <mesh position={[arrow.scale / 2, 0, 0]}>
                <boxGeometry args={[arrow.scale, VISUAL_CONFIG.ARROW_BODY_THICKNESS, VISUAL_CONFIG.ARROW_BODY_THICKNESS]} />

                <meshBasicMaterial color={VISUAL_CONFIG.VECTOR_BODY_COLOR} transparent opacity={VISUAL_CONFIG.VECTOR_OPACITY} />
            </mesh>
            {/* Tête de la flèche */}
            <mesh position={[arrow.scale, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[VISUAL_CONFIG.ARROW_HEAD_RADIUS, VISUAL_CONFIG.ARROW_HEAD_HEIGHT, 4]} />
                <meshBasicMaterial color={VISUAL_CONFIG.VECTOR_HEAD_COLOR} transparent opacity={VISUAL_CONFIG.VECTOR_OPACITY} />
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
    mesh.current.position.x = THREE.MathUtils.lerp(mesh.current.position.x, data.x, VISUAL_CONFIG.PARTICLE_LERP_SPEED);
    mesh.current.position.y = THREE.MathUtils.lerp(mesh.current.position.y, data.y, VISUAL_CONFIG.PARTICLE_LERP_SPEED);
    
    const scale = 1 + Math.sin(state.clock.elapsedTime * VISUAL_CONFIG.PARTICLE_SCALE_FREQUENCY + data.id) * VISUAL_CONFIG.PARTICLE_SCALE_AMPLITUDE;
    mesh.current.scale.set(scale, scale, scale);
  });

  const color = data.isNew ? VISUAL_CONFIG.PARTICLE_NEW_COLOR : VISUAL_CONFIG.PARTICLE_OLD_COLOR;
  const opacity = data.isNew ? VISUAL_CONFIG.PARTICLE_NEW_OPACITY : VISUAL_CONFIG.PARTICLE_OLD_OPACITY;
  const emissiveIntensity = data.isNew ? VISUAL_CONFIG.PARTICLE_EMISSIVE_INTENSITY_NEW : VISUAL_CONFIG.PARTICLE_EMISSIVE_INTENSITY_OLD;

  return (
    <mesh ref={mesh} position={[data.prevX, data.prevY, 0]}>
      <sphereGeometry args={[VISUAL_CONFIG.PARTICLE_RADIUS, 16, 16]} />
      <meshStandardMaterial 
        color={color} 
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        transparent 
        opacity={opacity} 
      />
      {data.isNew && <pointLight distance={1} intensity={2} color={VISUAL_CONFIG.PARTICLE_NEW_COLOR} />}
    </mesh>
  );
};

// 3. Cercle Unitaire (Limite de stabilité)
const UnitCircle = () => {
  const rayon = VISUAL_CONFIG.STABILITY_CIRCLE_RADIUS;
  const length = VISUAL_CONFIG.STABILITY_CIRCLE_THICKNESS;
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[rayon - length, rayon + length, 128]} />
            <meshBasicMaterial color={VISUAL_CONFIG.STABILITY_CIRCLE_COLOR} transparent opacity={VISUAL_CONFIG.STABILITY_CIRCLE_OPACITY} side={THREE.DoubleSide} />
        </mesh>
    </group>
  )
}

// 4. Grille Personnalisée (Remplacement de Drei Grid)
const CustomGrid = () => {
  return <primitive object={new THREE.GridHelper(VISUAL_CONFIG.GRID_SIZE, VISUAL_CONFIG.GRID_SIZE, VISUAL_CONFIG.GRID_COLOR, VISUAL_CONFIG.GRID_COLOR)} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />
}

// 5. Axes X et Y
const Axes = () => {
  const axisLength = VISUAL_CONFIG.AXIS_LENGTH;
  const thickness = VISUAL_CONFIG.AXIS_THICKNESS;
  const arrowSize = VISUAL_CONFIG.AXIS_ARROW_SIZE;
  const arrowHeight = VISUAL_CONFIG.AXIS_ARROW_HEIGHT;
  
  return (
    <group>
      {/* Axe X (Rouge) */}
      <group>
        {/* Ligne X */}
        <mesh position={[axisLength / 2, 0, 0]}>
          <boxGeometry args={[axisLength, thickness, thickness]} />
          <meshBasicMaterial color={VISUAL_CONFIG.AXIS_X_COLOR} transparent opacity={VISUAL_CONFIG.AXIS_OPACITY} />
        </mesh>
        {/* Flèche X positive */}
        <mesh position={[axisLength - arrowHeight/2 + 0.01, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[arrowSize, arrowHeight, 8]} />
          <meshBasicMaterial color={VISUAL_CONFIG.AXIS_X_COLOR} transparent opacity={VISUAL_CONFIG.AXIS_OPACITY} />
        </mesh>
      </group>
      
      {/* Axe Y (Vert) */}
      <group>
        {/* Ligne Y */}
        <mesh position={[0, axisLength / 2, 0]}>
          <boxGeometry args={[thickness, axisLength, thickness]} />
          <meshBasicMaterial color={VISUAL_CONFIG.AXIS_Y_COLOR} transparent opacity={VISUAL_CONFIG.AXIS_OPACITY} />
        </mesh>
        {/* Flèche Y positive */}
        <mesh position={[0, axisLength - arrowHeight/2 + 0.01, 0]}>
          <coneGeometry args={[arrowSize, arrowHeight, 8]} />
          <meshBasicMaterial color={VISUAL_CONFIG.AXIS_Y_COLOR} transparent opacity={VISUAL_CONFIG.AXIS_OPACITY} />
        </mesh>

      </group>
    </group>
  );
};

// 6. Visualisation de la matrice W (vecteurs colonnes)
const MatrixVisualization = ({ matrix }) => {
  const thickness = VISUAL_CONFIG.MATRIX_VECTOR_THICKNESS;
  const arrowSize = VISUAL_CONFIG.MATRIX_ARROW_SIZE;
  const arrowHeight = VISUAL_CONFIG.MATRIX_ARROW_HEIGHT;
  
  // Première colonne de W : [a, c]
  const col1 = { x: matrix.a, y: matrix.c };
  const col1Length = Math.sqrt(col1.x * col1.x + col1.y * col1.y);
  const col1Angle = Math.atan2(col1.y, col1.x);
  
  // Deuxième colonne de W : [b, d]
  const col2 = { x: matrix.b, y: matrix.d };
  const col2Length = Math.sqrt(col2.x * col2.x + col2.y * col2.y);
  const col2Angle = Math.atan2(col2.y, col2.x);
  
  return (
    <group>
      {/* Première colonne de W (Orange) */}
      {col1Length > 0.01 && (
        <group rotation={[0, 0, col1Angle]}>
          {/* Corps du vecteur */}
          <mesh position={[col1Length / 2, 0, 0]}>
            <boxGeometry args={[col1Length, thickness, thickness]} />
            <meshBasicMaterial 
              color={VISUAL_CONFIG.MATRIX_VECTOR_1_COLOR} 
              transparent 
              opacity={VISUAL_CONFIG.MATRIX_VECTOR_OPACITY} 
            />
          </mesh>
          {/* Flèche */}
          <mesh position={[col1Length, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[arrowSize, arrowHeight, 8]} />
            <meshBasicMaterial 
              color={VISUAL_CONFIG.MATRIX_VECTOR_1_COLOR} 
              transparent 
              opacity={VISUAL_CONFIG.MATRIX_VECTOR_OPACITY} 
            />
          </mesh>
        </group>
      )}
      
      {/* Deuxième colonne de W (Violet) */}
      {col2Length > 0.01 && (
        <group rotation={[0, 0, col2Angle]}>
          {/* Corps du vecteur */}
          <mesh position={[col2Length / 2, 0, 0]}>
            <boxGeometry args={[col2Length, thickness, thickness]} />
            <meshBasicMaterial 
              color={VISUAL_CONFIG.MATRIX_VECTOR_2_COLOR} 
              transparent 
              opacity={VISUAL_CONFIG.MATRIX_VECTOR_OPACITY} 
            />
          </mesh>
          {/* Flèche */}
          <mesh position={[col2Length, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[arrowSize, arrowHeight, 8]} />
            <meshBasicMaterial 
              color={VISUAL_CONFIG.MATRIX_VECTOR_2_COLOR} 
              transparent 
              opacity={VISUAL_CONFIG.MATRIX_VECTOR_OPACITY} 
            />
          </mesh>
        </group>
      )}
    </group>
  );
};

/**
 * --- COMPOSANT PRINCIPAL ---
 */
export default function ReservoirLinearViz() {
  // État de la matrice W (2x2) sous forme de tableau [a, b, c, d]
  // Représente la matrice: [a b]
  //                        [c d]
  const [matrixValues, setMatrixValues] = useState(INIT_MATRIX_VALUES); // Matrice identité scaled
  const [particles, setParticles] = useState([]);
  const [stepCount, setStepCount] = useState(0);

  const W = useMemo(() => ({
    a: matrixValues[0],
    b: matrixValues[1], 
    c: matrixValues[2],
    d: matrixValues[3]
  }), [matrixValues]);

  // Fonction pour mettre à jour une valeur de la matrice
  const updateMatrixValue = (index, value) => {
    const newValues = [...matrixValues];
    newValues[index] = parseFloat(value) || 0;
    setMatrixValues(newValues);
  };

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
        return Math.sqrt(p.x*p.x + p.y*p.y) > VISUAL_CONFIG.PARTICLE_MIN_DISTANCE;
      });

      if (injectInput) {
        const xinVector = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
        const newX = xinVector.x * INIT_WIN_VALUES[0] + xinVector.y * INIT_WIN_VALUES[1];
        const newY = xinVector.x * INIT_WIN_VALUES[2] + xinVector.y * INIT_WIN_VALUES[3];

        nextParticles.push({
          id: Date.now() + Math.random(),
          prevX: newX * VISUAL_CONFIG.INPUT_POSITION_SCALE,
          prevY: newY * VISUAL_CONFIG.INPUT_POSITION_SCALE,
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
          <div className="space-y-4">
            {/* Grille de la matrice 2x2 */}
            <div className="bg-slate-700/30 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                {/* Première ligne */}
                <div className="flex flex-row">
                  <label className="text-xs text-slate-400 mb-1">W₁₁</label>
                  <input
                    type="number"
                    step="0.01"
                    value={matrixValues[0]}
                    onChange={(e) => updateMatrixValue(0, e.target.value)}
                    className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div className="flex flex-row">
                  <label className="text-xs text-slate-400 mb-1">W₁₂</label>
                  <input
                    type="number"
                    step="0.01"
                    value={matrixValues[1]}
                    onChange={(e) => updateMatrixValue(1, e.target.value)}
                    className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                
                {/* Deuxième ligne */}
                <div className="flex flex-row">
                  <label className="text-xs text-slate-400 mb-1">W₂₁</label>
                  <input
                    type="number"
                    step="0.01"
                    value={matrixValues[2]}
                    onChange={(e) => updateMatrixValue(2, e.target.value)}
                    className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div className="flex flex-row">
                  <label className="text-xs text-slate-400 mb-1">W₂₂</label>
                  <input
                    type="number"
                    step="0.01"
                    value={matrixValues[3]}
                    onChange={(e) => updateMatrixValue(3, e.target.value)}
                    className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>
              
              {/* Informations sur la stabilité */}
              <div className="mt-3 pt-3 border-t border-slate-600">
                <div className="text-xs text-slate-400">
                  <div>Trace: {(matrixValues[0] + matrixValues[3]).toFixed(3)}</div>
                  <div>Det: {(matrixValues[0] * matrixValues[3] - matrixValues[1] * matrixValues[2]).toFixed(3)}</div>
                  <div>Spectral Radius: {Math.max(Math.abs(matrixValues[0]), Math.abs(matrixValues[3])).toFixed(3)}</div>
                </div>
              </div>
            </div>
            
            
          </div>
        </div>
      </div>

      {/* -- 3D -- */}
      <div className="flex-1 relative cursor-move">
        <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
          <color attach="background" args={['#0f172a']} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          
          <CustomGrid />
          <Axes />
          <MatrixVisualization matrix={W} />
          <VectorField matrix={W} />
          <UnitCircle />
          <ParticleSystem particles={particles} />

          <OrbitControls 
            enablePan={true} 
            enableZoom={true} 
            enableRotate={true}
            minPolarAngle={ -Math.PI}
            maxPolarAngle={Math.PI}
            minAzimuthAngle={ 0 }
            maxAzimuthAngle={ 0 }
          />
        </Canvas>
        
      </div>
    </div>
  );
}