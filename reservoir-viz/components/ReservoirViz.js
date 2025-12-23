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
  AXIS_Z_COLOR: "#3b82f6", // Bleu pour Z (axe imaginaire i)
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
  
  // Vecteurs propres et valeurs propres
  EIGEN_VECTOR_THICKNESS: 0.015,
  EIGEN_VECTOR_1_COLOR: "#10b981", // Vert emeraude pour v₁
  EIGEN_VECTOR_2_COLOR: "#f97316", // Orange pour v₂
  EIGEN_VALUE_1_COLOR: "#06b6d4", // Cyan pour λ₁
  EIGEN_VALUE_2_COLOR: "#ec4899", // Rose pour λ₂
  EIGEN_OPACITY: 0.9,
  EIGEN_ARROW_SIZE: 0.04,
  EIGEN_ARROW_HEIGHT: 0.1,
  
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
// const INIT_MATRIX_VALUES = [0.9, 0.3, -0.3, 0.9]; // Matrice identité scaled
const INIT_MATRIX_VALUES = [0, -1, 1, 0]; // Matrice identité scaled

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

// 5. Axes X, Y et Z
const Axes = () => {
  const axisLength = VISUAL_CONFIG.AXIS_LENGTH;
  const thickness = VISUAL_CONFIG.AXIS_THICKNESS;
  const arrowSize = VISUAL_CONFIG.AXIS_ARROW_SIZE;
  const arrowHeight = VISUAL_CONFIG.AXIS_ARROW_HEIGHT;
  
  return (
    <group>
      {/* Axe X (Rouge) - Partie réelle */}
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
      
      {/* Axe Y (Vert) - Partie réelle */}
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
      
      {/* Axe Z (Bleu) - Axe imaginaire i */}
      <group>
        {/* Ligne Z */}
        <mesh position={[0, 0, axisLength / 2]}>
          <boxGeometry args={[thickness, thickness, axisLength]} />
          <meshBasicMaterial color={VISUAL_CONFIG.AXIS_Z_COLOR} transparent opacity={VISUAL_CONFIG.AXIS_OPACITY} />
        </mesh>
        {/* Flèche Z positive */}
        <mesh position={[0, 0, axisLength - arrowHeight/2 + 0.01]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[arrowSize, arrowHeight, 8]} />
          <meshBasicMaterial color={VISUAL_CONFIG.AXIS_Z_COLOR} transparent opacity={VISUAL_CONFIG.AXIS_OPACITY} />
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

// 7. Visualisation des valeurs propres et vecteurs propres
const EigenVisualization = ({ eigenAnalysis }) => {
  const thickness = VISUAL_CONFIG.EIGEN_VECTOR_THICKNESS;
  const arrowSize = VISUAL_CONFIG.EIGEN_ARROW_SIZE;
  const arrowHeight = VISUAL_CONFIG.EIGEN_ARROW_HEIGHT;
  
  // Fonction pour créer un vecteur 3D à partir d'un nombre complexe
  const createComplexVector = (complexNum, scale = 1) => {
    if (!complexNum) return { x: 0, y: 0, z: 0, length: 0 };
    
    const real = isNaN(complexNum.real) ? (isNaN(complexNum) ? 0 : Number(complexNum) || 0) : Number(complexNum.real) || 0;
    const imag = isNaN(complexNum.imag) ? 0 : Number(complexNum.imag) || 0;
    const safeScale = isNaN(scale) ? 1 : Number(scale) || 1;
    
    const x = real * safeScale;
    const y = 0;
    const z = imag * safeScale;
    const length = Math.sqrt(real * real + imag * imag) * safeScale;
    
    return {
      x: isNaN(x) ? 0 : x,
      y: isNaN(y) ? 0 : y,
      z: isNaN(z) ? 0 : z,
      length: isNaN(length) ? 0 : length
    };
  };

  // Fonction pour créer un vecteur propre 3D
  const createEigenVector = (eigenvector, scale = 1) => {
    if (!eigenvector || !eigenvector.x || !eigenvector.y) {
      return { x: 0, y: 0, z: 0, length: 0 };
    }
    
    const safeScale = isNaN(scale) ? 1 : Number(scale) || 1;
    
    const xReal = (isNaN(eigenvector.x.real) ? 0 : Number(eigenvector.x.real) || 0) * safeScale;
    const xImag = (isNaN(eigenvector.x.imag) ? 0 : Number(eigenvector.x.imag) || 0) * safeScale;
    const yReal = (isNaN(eigenvector.y.real) ? 0 : Number(eigenvector.y.real) || 0) * safeScale;
    const yImag = (isNaN(eigenvector.y.imag) ? 0 : Number(eigenvector.y.imag) || 0) * safeScale;
    
    const x = isNaN(xReal) ? 0 : xReal;
    const y = isNaN(yReal) ? 0 : yReal;
    const z = isNaN(xImag + yImag) ? 0 : (xImag + yImag); // Somme des parties imaginaires sur l'axe Z
    const length = Math.sqrt(x*x + y*y + z*z);
    
    return {
      x,
      y,
      z,
      length: isNaN(length) ? 0 : length
    };
  };

  // Calcul des positions des valeurs propres (comme vecteurs depuis l'origine)
  const eigenValue1Vec = createComplexVector(eigenAnalysis.eigenvalue1, 1.5);
  const eigenValue2Vec = createComplexVector(eigenAnalysis.eigenvalue2, 1.5);
  
  // Calcul des vecteurs propres
  const eigenVector1 = createEigenVector(eigenAnalysis.eigenvector1, 1.2);
  const eigenVector2 = createEigenVector(eigenAnalysis.eigenvector2, 1.2);
  
  // Fonction pour créer une flèche 3D
  const Arrow3D = ({ start, end, color, thickness: t }) => {
    // Vérifications de sécurité
    if (!start || !end) return null;
    if (isNaN(start.x) || isNaN(start.y) || isNaN(start.z)) return null;
    if (isNaN(end.x) || isNaN(end.y) || isNaN(end.z)) return null;
    if (isNaN(t) || t <= 0) return null;
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;  
    const dz = end.z - start.z;
    const length = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    if (isNaN(length) || length < 0.01) return null;
    
    // Position du milieu pour le corps
    const midX = start.x + dx/2;
    const midY = start.y + dy/2;
    const midZ = start.z + dz/2;
    
    // Vérifications supplémentaires
    if (isNaN(midX) || isNaN(midY) || isNaN(midZ)) return null;
    
    // Calcul des angles de rotation
    const phi = Math.atan2(Math.sqrt(dx*dx + dz*dz), dy);
    const theta = Math.atan2(dx, dz);
    
    if (isNaN(phi) || isNaN(theta)) return null;
    
    return (
      <group>
        {/* Corps de la flèche */}
        <mesh 
          position={[midX, midY, midZ]} 
          rotation={[phi, theta, 0]}
        >
          <cylinderGeometry args={[t/2, t/2, length, 8]} />
          <meshBasicMaterial color={color} transparent opacity={VISUAL_CONFIG.EIGEN_OPACITY} />
        </mesh>
        {/* Tête de flèche */}
        <mesh 
          position={[end.x, end.y, end.z]}
          rotation={end.z < 0 ? [phi + Math.PI, theta, 0] : [phi, theta, 0]}
        >
          <coneGeometry args={[arrowSize, arrowHeight, 8]} />
          <meshBasicMaterial color={color} transparent opacity={VISUAL_CONFIG.EIGEN_OPACITY} />
        </mesh>
      </group>
    );
  };
  
  return (
    <group>
      {/* Valeur propre λ₁ (comme vecteur) */}
      <Arrow3D 
        start={{x: 0, y: 0, z: 0}} 
        end={eigenValue1Vec} 
        color={VISUAL_CONFIG.EIGEN_VALUE_1_COLOR} 
        thickness={thickness/2}
      />

      {/* Valeur propre λ₂ (comme vecteur) */}
      <Arrow3D 
        start={{x: 0, y: 0, z: 0}} 
        end={eigenValue2Vec} 
        color={VISUAL_CONFIG.EIGEN_VALUE_2_COLOR} 
        thickness={thickness/2}
      />

      {/* Vecteur propre v₁ */}
      <Arrow3D 
        start={{x: 0, y: 0, z: 0}} 
        end={eigenVector1} 
        color={VISUAL_CONFIG.EIGEN_VECTOR_1_COLOR} 
        thickness={thickness}
      />

      {/* Vecteur propre v₂ */}
      <Arrow3D 
        start={{x: 0, y: 0, z: 0}} 
        end={eigenVector2} 
        color={VISUAL_CONFIG.EIGEN_VECTOR_2_COLOR} 
        thickness={thickness}
      />
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

  // Calcul des valeurs propres et vecteurs propres pour une matrice 2x2
  const eigenAnalysis = useMemo(() => {
    const a = isNaN(matrixValues[0]) ? 0 : matrixValues[0]; // W₁₁
    const b = isNaN(matrixValues[1]) ? 0 : matrixValues[1]; // W₁₂
    const c = isNaN(matrixValues[2]) ? 0 : matrixValues[2]; // W₂₁
    const d = isNaN(matrixValues[3]) ? 0 : matrixValues[3]; // W₂₂
    
    // Calcul des valeurs propres: λ = (trace ± √(discriminant)) / 2
    const trace = a + d;
    const det = a * d - b * c;
    const discriminant = trace * trace - 4 * det;
    
    let eigenvalue1, eigenvalue2;
    let eigenvector1, eigenvector2;
    let isComplex = false;
    
    // Vérifications de sécurité
    if (isNaN(trace) || isNaN(det) || isNaN(discriminant)) {
      // Valeurs par défaut en cas d'erreur
      return {
        eigenvalue1: { real: 0, imag: 0 },
        eigenvalue2: { real: 0, imag: 0 },
        eigenvector1: { x: { real: 1, imag: 0 }, y: { real: 0, imag: 0 } },
        eigenvector2: { x: { real: 0, imag: 0 }, y: { real: 1, imag: 0 } },
        isComplex: false,
        spectralRadius: 0
      };
    }
    
    if (discriminant >= 0) {
      // Valeurs propres réelles
      const sqrtDiscriminant = Math.sqrt(discriminant);
      eigenvalue1 = (trace + sqrtDiscriminant) / 2;
      eigenvalue2 = (trace - sqrtDiscriminant) / 2;
      
      // Calcul des vecteurs propres
      // Pour λ₁: (W - λ₁I)v = 0
      if (Math.abs(b) > 1e-10) {
        eigenvector1 = { x: 1, y: (eigenvalue1 - a) / b };
        eigenvector2 = { x: 1, y: (eigenvalue2 - a) / b };
      } else if (Math.abs(c) > 1e-10) {
        eigenvector1 = { x: (eigenvalue1 - d) / c, y: 1 };
        eigenvector2 = { x: (eigenvalue2 - d) / c, y: 1 };
      } else {
        // Matrice diagonale
        eigenvector1 = { x: 1, y: 0 };
        eigenvector2 = { x: 0, y: 1 };
      }
      
      // Normalisation des vecteurs propres
      const norm1 = Math.sqrt(eigenvector1.x * eigenvector1.x + eigenvector1.y * eigenvector1.y);
      const norm2 = Math.sqrt(eigenvector2.x * eigenvector2.x + eigenvector2.y * eigenvector2.y);
      
      if (norm1 > 1e-10) {
        eigenvector1.x /= norm1;
        eigenvector1.y /= norm1;
      }
      if (norm2 > 1e-10) {
        eigenvector2.x /= norm2;
        eigenvector2.y /= norm2;
      }
      
      // Conversion vers format complexe uniforme pour l'affichage
      eigenvector1 = {
        x: { real: eigenvector1.x, imag: 0 },
        y: { real: eigenvector1.y, imag: 0 }
      };
      eigenvector2 = {
        x: { real: eigenvector2.x, imag: 0 },
        y: { real: eigenvector2.y, imag: 0 }
      };
      
    } else {
      // Valeurs propres complexes
      isComplex = true;
      const realPart = trace / 2;
      const imagPart = Math.sqrt(-discriminant) / 2;
      
      eigenvalue1 = { real: realPart, imag: imagPart };
      eigenvalue2 = { real: realPart, imag: -imagPart };
      
      // Pour les valeurs propres complexes, calcul des vecteurs propres complexes
      // (W - λI)v = 0 où λ = realPart + i*imagPart
      // On résout (W - realPart*I - i*imagPart*I)v = 0
      if (Math.abs(b) > 1e-10) {
        // v₁ = [1, (realPart - a)/b + i*imagPart/b]
        eigenvector1 = { 
          x: { real: 1, imag: 0 }, 
          y: { real: (realPart - a) / b, imag: imagPart / b } 
        };
        eigenvector2 = { 
          x: { real: 1, imag: 0 }, 
          y: { real: (realPart - a) / b, imag: -imagPart / b } 
        };
      } else if (Math.abs(c) > 1e-10) {
        eigenvector1 = { 
          x: { real: (realPart - d) / c, imag: imagPart / c }, 
          y: { real: 1, imag: 0 } 
        };
        eigenvector2 = { 
          x: { real: (realPart - d) / c, imag: -imagPart / c }, 
          y: { real: 1, imag: 0 } 
        };
      } else {
        eigenvector1 = { 
          x: { real: 1, imag: 0 }, 
          y: { real: 0, imag: 0 } 
        };
        eigenvector2 = { 
          x: { real: 0, imag: 0 }, 
          y: { real: 1, imag: 0 } 
        };
      }
    }
    
    return {
      eigenvalue1,
      eigenvalue2,
      eigenvector1,
      eigenvector2,
      isComplex,
      spectralRadius: (() => {
        if (isComplex) {
          const real1 = eigenvalue1.real || 0;
          const imag1 = eigenvalue1.imag || 0;
          const radius = Math.sqrt(real1 * real1 + imag1 * imag1);
          return isNaN(radius) ? 0 : radius;
        } else {
          const abs1 = Math.abs(eigenvalue1 || 0);
          const abs2 = Math.abs(eigenvalue2 || 0);
          const max = Math.max(abs1, abs2);
          return isNaN(max) ? 0 : max;
        }
      })()
    };
  }, [matrixValues]);

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
              <div className="mt-3 pt-3 border-t border-slate-600 ">
                <div className="text-xs text-slate-400 flex flex-row justify-between">
                  {/* Informations sur la stabilité */}
                  <div>
                    <div>Trace: {isNaN(matrixValues[0] + matrixValues[3]) ? '0.000' : (matrixValues[0] + matrixValues[3]).toFixed(3)}</div>
                    <div>Det: {isNaN(matrixValues[0] * matrixValues[3] - matrixValues[1] * matrixValues[2]) ? '0.000' : (matrixValues[0] * matrixValues[3] - matrixValues[1] * matrixValues[2]).toFixed(3)}</div>
                    <div>Spectral Radius: {isNaN(eigenAnalysis.spectralRadius) ? '0.000' : eigenAnalysis.spectralRadius.toFixed(3)}</div>
                  </div>

                  {/* Valeurs propres */}
                  <div className="pt-2 border-t border-slate-700">
                    <div className="font-semibold text-slate-300 mb-1">Valeurs propres:</div>
                    <>
                      <div>λ₁: {(() => {
                        const real1 = eigenAnalysis.eigenvalue1.real || eigenAnalysis.eigenvalue1 || 0;
                        const imag1 = eigenAnalysis.eigenvalue1.imag || 0;
                        return `${isNaN(real1) ? '0.000' : real1.toFixed(3)}${isNaN(imag1) ? '' : (imag1 >= 0 ? '+' : '') + imag1.toFixed(3) + 'i'}`;
                      })()}</div>
                      <div>λ₂: {(() => {
                        const real2 = eigenAnalysis.eigenvalue2.real || eigenAnalysis.eigenvalue2 || 0;
                        const imag2 = eigenAnalysis.eigenvalue2.imag || 0;
                        return `${isNaN(real2) ? '0.000' : real2.toFixed(3)}${isNaN(imag2) ? '' : (imag2 >= 0 ? '+' : '') + imag2.toFixed(3) + 'i'}`;
                      })()}</div>
                    </>
                  </div>
                  
                  {/* Vecteurs propres */}
                  <div className="pt-2 border-t border-slate-700">
                    <div className="font-semibold text-slate-300 mb-1">Vecteurs propres:</div>
                    <div>v₁: [{(() => {
                      const xReal = eigenAnalysis.eigenvector1?.x?.real || 0;
                      const xImag = eigenAnalysis.eigenvector1?.x?.imag || 0;
                      const yReal = eigenAnalysis.eigenvector1?.y?.real || 0;
                      const yImag = eigenAnalysis.eigenvector1?.y?.imag || 0;
                      return `${isNaN(xReal) ? '0.000' : xReal.toFixed(3)}${isNaN(xImag) ? '' : (xImag >= 0 ? '+' : '') + xImag.toFixed(3) + 'i'}, ${isNaN(yReal) ? '0.000' : yReal.toFixed(3)}${isNaN(yImag) ? '' : (yImag >= 0 ? '+' : '') + yImag.toFixed(3) + 'i'}`;
                    })()}]</div>
                    <div>v₂: [{(() => {
                      const xReal = eigenAnalysis.eigenvector2?.x?.real || 0;
                      const xImag = eigenAnalysis.eigenvector2?.x?.imag || 0;
                      const yReal = eigenAnalysis.eigenvector2?.y?.real || 0;
                      const yImag = eigenAnalysis.eigenvector2?.y?.imag || 0;
                      return `${isNaN(xReal) ? '0.000' : xReal.toFixed(3)}${isNaN(xImag) ? '' : (xImag >= 0 ? '+' : '') + xImag.toFixed(3) + 'i'}, ${isNaN(yReal) ? '0.000' : yReal.toFixed(3)}${isNaN(yImag) ? '' : (yImag >= 0 ? '+' : '') + yImag.toFixed(3) + 'i'}`;
                    })()}]</div>
                  </div>
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
          <EigenVisualization eigenAnalysis={eigenAnalysis} />
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