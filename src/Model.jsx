import { useRef, useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { cardioAnatomyData } from './CardioAnatomyData';

// Shared Helpers
const shareParentRegion = (name1, name2) => {
  if (!name1 || !name2) return false;
  const base1 = name1.split('.').slice(0, 2).join('.').toLowerCase();
  const base2 = name2.split('.').slice(0, 2).join('.').toLowerCase();
  return base1 === base2;
};

const handlePointerMove = (e, setHoveredMeshName, onHoverOrgan) => {
  e.stopPropagation();
  if (e.face && e.object && e.object.isMesh) {
    const meshName = e.object.name;
    setHoveredMeshName(meshName);
    if (onHoverOrgan) onHoverOrgan(meshName);
  }
};

const handlePointerOut = (e, setHoveredMeshName, onHoverOrgan) => {
  e.stopPropagation();
  setHoveredMeshName(null);
  if (onHoverOrgan) onHoverOrgan(null);
};

const handlePointerClick = (e, onSelectOrgan) => {
  e.stopPropagation();
  if (e.object && e.object.isMesh) {
    const meshName = e.object.name;
    if (onSelectOrgan) {
      onSelectOrgan(meshName);
    }
  }
};

// 1. Skeleton Model (Loaded by default)
function SkeletonModel({ showSkeleton, activeOrgan, hoveredOrgan, hoveredMeshName, setHoveredMeshName, onSelectOrgan, onHoverOrgan, highlightedOrgans }) {
  if (!showSkeleton) return null;
  const skeleton = useGLTF('./SkeletonJoints.glb');
  
  useEffect(() => {
    if (skeleton && skeleton.scene) {
      skeleton.scene.traverse((child) => {
        if (child.isMesh) {
          if (!(child.material instanceof THREE.MeshStandardMaterial) || child.material.name !== 'soma-bone') {
            child.material = new THREE.MeshStandardMaterial({
              name: 'soma-bone',
              color: new THREE.Color('#eae6df'), // Clean, realistic ivory/bone-white
              roughness: 0.8,
              metalness: 0.05,
              side: THREE.DoubleSide
            });
          }
        }
      });
    }
  }, [skeleton]);

  useEffect(() => {
    if (skeleton && skeleton.scene) {
      skeleton.scene.traverse((child) => {
        if (child.isMesh) {
          const isSelected = child.name === activeOrgan || highlightedOrgans.includes(child.name) || shareParentRegion(child.name, activeOrgan);
          const isHovered = child.name === hoveredOrgan || child.name === hoveredMeshName || shareParentRegion(child.name, hoveredOrgan) || shareParentRegion(child.name, hoveredMeshName);

          if (isSelected) {
            child.material.color.set('#3b82f6');
            child.material.opacity = 1.0;
            child.material.transparent = false;
            child.material.roughness = 0.4;
            child.material.metalness = 0.2;
            child.material.needsUpdate = true;
          } else if (isHovered) {
            child.material.color.set('#cbd5e1');
            child.material.opacity = 0.95;
            child.material.transparent = true;
            child.material.roughness = 0.6;
            child.material.metalness = 0.1;
            child.material.needsUpdate = true;
          } else {
            child.material.color.set('#eae6df');
            child.material.opacity = 1.0;
            child.material.transparent = false;
            child.material.roughness = 0.8;
            child.material.metalness = 0.05;
            child.material.needsUpdate = true;
          }
        }
      });
    }
  }, [skeleton, activeOrgan, hoveredOrgan, hoveredMeshName, highlightedOrgans]);

  return (
    <primitive
      object={skeleton.scene}
      onPointerMove={(e) => handlePointerMove(e, setHoveredMeshName, onHoverOrgan)}
      onPointerOut={(e) => handlePointerOut(e, setHoveredMeshName, onHoverOrgan)}
      onClick={(e) => handlePointerClick(e, onSelectOrgan)}
    />
  );
}

// 2. Body Model (Lazy-loaded)
function BodyModel({ showBody, activeOrgan, hoveredOrgan, hoveredMeshName, setHoveredMeshName, onSelectOrgan, onHoverOrgan, highlightedOrgans }) {
  if (!showBody) return null;
  const { scene } = useGLTF('./human_model.glb');
  const originalMaterialsRef = useRef(new Map());

  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child.isMesh) {
          const cacheKey = `body_${child.name}`;
          if (!originalMaterialsRef.current.has(cacheKey)) {
            const originalMat = child.material;
            originalMaterialsRef.current.set(cacheKey, {
              color: originalMat.color ? originalMat.color.clone() : new THREE.Color(0xf8fafc),
              map: originalMat.map || null,
              normalMap: originalMat.normalMap || null,
              bumpMap: originalMat.bumpMap || null,
              roughnessMap: originalMat.roughnessMap || null,
              metalnessMap: originalMat.metalnessMap || null,
              roughness: originalMat.roughness ?? 0.7,
              metalness: originalMat.metalness ?? 0.1,
              opacity: originalMat.opacity ?? 1.0,
              transparent: originalMat.transparent ?? false
            });
            child.material = originalMat.clone();
            child.material.side = THREE.FrontSide;
          }
        }
      });
    }
  }, [scene]);

  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        let isHair = false;
        let temp = child;
        while (temp) {
          if (temp.name && (temp.name.startsWith('Hair.Hairs of head') || temp.name.startsWith('Hair.Pubic hairs'))) {
            isHair = true;
            break;
          }
          temp = temp.parent;
        }
        if (isHair) {
          child.visible = false;
        }

        if (child.isMesh) {
          const isSelected = child.name === activeOrgan || highlightedOrgans.includes(child.name) || shareParentRegion(child.name, activeOrgan);
          const isHovered = child.name === hoveredOrgan || child.name === hoveredMeshName || shareParentRegion(child.name, hoveredOrgan) || shareParentRegion(child.name, hoveredMeshName);
          const orig = originalMaterialsRef.current.get(`body_${child.name}`);

          if (isSelected) {
            child.material.color.set('#3b82f6');
            child.material.map = null;
            child.material.normalMap = null;
            child.material.bumpMap = null;
            child.material.roughnessMap = null;
            child.material.metalnessMap = null;
            child.material.opacity = 1.0;
            child.material.transparent = false;
            if ('roughness' in child.material) child.material.roughness = 0.4;
            if ('metalness' in child.material) child.material.metalness = 0.2;
            child.material.needsUpdate = true;
          } else if (isHovered) {
            child.material.color.set('#cbd5e1');
            child.material.map = null;
            child.material.normalMap = null;
            child.material.bumpMap = null;
            child.material.roughnessMap = null;
            child.material.metalnessMap = null;
            child.material.opacity = 0.95;
            child.material.transparent = true;
            if ('roughness' in child.material) child.material.roughness = 0.6;
            if ('metalness' in child.material) child.material.metalness = 0.1;
            child.material.needsUpdate = true;
          } else {
            if (orig) {
              child.material.color.copy(orig.color);
              child.material.map = orig.map;
              child.material.normalMap = orig.normalMap;
              child.material.bumpMap = orig.bumpMap;
              child.material.roughnessMap = orig.roughnessMap;
              child.material.metalnessMap = orig.metalnessMap;
              child.material.opacity = orig.opacity;
              child.material.transparent = orig.transparent;
              if ('roughness' in child.material) child.material.roughness = orig.roughness;
              if ('metalness' in child.material) child.material.metalness = orig.metalness;
              child.material.needsUpdate = true;
            } else {
              child.material.color.set('#f8fafc'); 
              child.material.opacity = 0.85;
              child.material.transparent = true;
              if ('roughness' in child.material) child.material.roughness = 0.7;
              if ('metalness' in child.material) child.material.metalness = 0.1;
              child.material.needsUpdate = true;
            }
          }
        }
      });
    }
  }, [scene, activeOrgan, hoveredOrgan, hoveredMeshName, highlightedOrgans]);

  return (
    <primitive
      object={scene}
      onPointerMove={(e) => handlePointerMove(e, setHoveredMeshName, onHoverOrgan)}
      onPointerOut={(e) => handlePointerOut(e, setHoveredMeshName, onHoverOrgan)}
      onClick={(e) => handlePointerClick(e, onSelectOrgan)}
    />
  );
}

// 3. Cardiovascular Model (Lazy-loaded)
function CardioModel({ showCardio, activeOrgan, hoveredOrgan, hoveredMeshName, setHoveredMeshName, onSelectOrgan, onHoverOrgan, highlightedOrgans }) {
  if (!showCardio) return null;
  const cardio = useGLTF('./Cardiovascular_system.glb');
  const originalMaterialsRef = useRef(new Map());

  useEffect(() => {
    if (cardio && cardio.scene) {
      cardio.scene.traverse((child) => {
        if (child.isMesh) {
          // Hide cardiovascular heart meshes
          const isCardioHeart = cardioAnatomyData[child.name]?.group === 'Heart';
          if (isCardioHeart) {
            child.visible = false;
          }
          
          const cacheKey = `cardio_${child.name}`;
          if (!originalMaterialsRef.current.has(cacheKey)) {
            const originalMat = child.material;
            const clonedMat = originalMat.clone();
            clonedMat.side = THREE.FrontSide;

            originalMaterialsRef.current.set(cacheKey, {
              color: clonedMat.color.clone(),
              map: originalMat.map || null,
              normalMap: originalMat.normalMap || null,
              bumpMap: originalMat.bumpMap || null,
              roughnessMap: originalMat.roughnessMap || null,
              metalnessMap: originalMat.metalnessMap || null,
              roughness: clonedMat.roughness ?? 0.7,
              metalness: clonedMat.metalness ?? 0.1,
              opacity: originalMat.opacity ?? 1.0,
              transparent: originalMat.transparent ?? false
            });
            child.material = clonedMat;
          }
        }
      });
    }
  }, [cardio]);

  useEffect(() => {
    if (cardio && cardio.scene) {
      cardio.scene.traverse((child) => {
        if (child.isMesh) {
          const isCardioHeart = cardioAnatomyData[child.name]?.group === 'Heart';
          if (isCardioHeart) {
            child.visible = false;
            return;
          }

          const isSelected = child.name === activeOrgan || highlightedOrgans.includes(child.name) || shareParentRegion(child.name, activeOrgan);
          const isHovered = child.name === hoveredOrgan || child.name === hoveredMeshName || shareParentRegion(child.name, hoveredOrgan) || shareParentRegion(child.name, hoveredMeshName);
          const orig = originalMaterialsRef.current.get(`cardio_${child.name}`);

          if (isSelected) {
            child.material.color.set('#3b82f6');
            child.material.map = null;
            child.material.normalMap = null;
            child.material.bumpMap = null;
            child.material.roughnessMap = null;
            child.material.metalnessMap = null;
            child.material.opacity = 1.0;
            child.material.transparent = false;
            if ('roughness' in child.material) child.material.roughness = 0.4;
            if ('metalness' in child.material) child.material.metalness = 0.2;
            child.material.needsUpdate = true;
          } else if (isHovered) {
            child.material.color.set('#cbd5e1');
            child.material.map = null;
            child.material.normalMap = null;
            child.material.bumpMap = null;
            child.material.roughnessMap = null;
            child.material.metalnessMap = null;
            child.material.opacity = 0.95;
            child.material.transparent = true;
            if ('roughness' in child.material) child.material.roughness = 0.6;
            if ('metalness' in child.material) child.material.metalness = 0.1;
            child.material.needsUpdate = true;
          } else {
            if (orig) {
              child.material.color.copy(orig.color);
              child.material.map = orig.map;
              child.material.normalMap = orig.normalMap;
              child.material.bumpMap = orig.bumpMap;
              child.material.roughnessMap = orig.roughnessMap;
              child.material.metalnessMap = orig.metalnessMap;
              child.material.opacity = orig.opacity;
              child.material.transparent = orig.transparent;
              if ('roughness' in child.material) child.material.roughness = orig.roughness;
              if ('metalness' in child.material) child.material.metalness = orig.metalness;
              child.material.needsUpdate = true;
            }
          }
        }
      });
    }
  }, [cardio, activeOrgan, hoveredOrgan, hoveredMeshName, highlightedOrgans]);

  return (
    <primitive
      object={cardio.scene}
      onPointerMove={(e) => handlePointerMove(e, setHoveredMeshName, onHoverOrgan)}
      onPointerOut={(e) => handlePointerOut(e, setHoveredMeshName, onHoverOrgan)}
      onClick={(e) => handlePointerClick(e, onSelectOrgan)}
    />
  );
}

// 4. Nervous Model (Lazy-loaded)
function NervousModel({ showNervous, activeOrgan, hoveredOrgan, hoveredMeshName, setHoveredMeshName, onSelectOrgan, onHoverOrgan, highlightedOrgans }) {
  if (!showNervous) return null;
  const nervous = useGLTF('./Nervous_system.glb?v=3');
  const originalMaterialsRef = useRef(new Map());

  useEffect(() => {
    if (nervous && nervous.scene) {
      nervous.scene.traverse((child) => {
        if (child.isMesh) {
          const cacheKey = `nervous_${child.name}`;
          if (!originalMaterialsRef.current.has(cacheKey)) {
            const originalMat = child.material;
            const clonedMat = originalMat.clone();
            clonedMat.side = THREE.FrontSide;

            const nameLower = child.name.toLowerCase();
            if (nameLower.includes('segment of eyeball') || nameLower.includes('chamber of eyeball') || nameLower.includes('axis of eyeball') || nameLower.includes('meridians of eyeball')) {
              clonedMat.transparent = true;
              clonedMat.opacity = 0.0;
              clonedMat.visible = false;
            } else if (nameLower.includes('cornea')) {
              clonedMat.transparent = true;
              clonedMat.opacity = 0.3; // Beautiful warm transparent brown eye lens dome!
            } else if (nameLower.includes('lens')) {
              clonedMat.transparent = true;
              clonedMat.opacity = 0.15;
            } else if (nameLower.includes('vitreous')) {
              clonedMat.transparent = true;
              clonedMat.opacity = 0.03;
            } else if (nameLower.includes('tympanic')) {
              clonedMat.transparent = true;
              clonedMat.opacity = 0.4;
            }

            originalMaterialsRef.current.set(cacheKey, {
              color: clonedMat.color.clone(),
              map: originalMat.map || null,
              normalMap: originalMat.normalMap || null,
              bumpMap: originalMat.bumpMap || null,
              roughnessMap: originalMat.roughnessMap || null,
              metalnessMap: originalMat.metalnessMap || null,
              roughness: clonedMat.roughness ?? 0.7,
              metalness: clonedMat.metalness ?? 0.1,
              opacity: clonedMat.opacity ?? 1.0,
              transparent: clonedMat.transparent ?? false
            });
            child.material = clonedMat;
          }
        }
      });
    }
  }, [nervous]);

  useEffect(() => {
    if (nervous && nervous.scene) {
      nervous.scene.traverse((child) => {
        if (child.isMesh) {
          const isSelected = child.name === activeOrgan || highlightedOrgans.includes(child.name) || shareParentRegion(child.name, activeOrgan);
          const isHovered = child.name === hoveredOrgan || child.name === hoveredMeshName || shareParentRegion(child.name, hoveredOrgan) || shareParentRegion(child.name, hoveredMeshName);
          const orig = originalMaterialsRef.current.get(`nervous_${child.name}`);

          if (isSelected) {
            child.material.color.set('#3b82f6');
            child.material.map = null;
            child.material.normalMap = null;
            child.material.bumpMap = null;
            child.material.roughnessMap = null;
            child.material.metalnessMap = null;
            child.material.opacity = 1.0;
            child.material.transparent = false;
            if ('roughness' in child.material) child.material.roughness = 0.4;
            if ('metalness' in child.material) child.material.metalness = 0.2;
            child.material.needsUpdate = true;
          } else if (isHovered) {
            child.material.color.set('#cbd5e1');
            child.material.map = null;
            child.material.normalMap = null;
            child.material.bumpMap = null;
            child.material.roughnessMap = null;
            child.material.metalnessMap = null;
            child.material.opacity = 0.95;
            child.material.transparent = true;
            if ('roughness' in child.material) child.material.roughness = 0.6;
            if ('metalness' in child.material) child.material.metalness = 0.1;
            child.material.needsUpdate = true;
          } else {
            if (orig) {
              child.material.color.copy(orig.color);
              child.material.map = orig.map;
              child.material.normalMap = orig.normalMap;
              child.material.bumpMap = orig.bumpMap;
              child.material.roughnessMap = orig.roughnessMap;
              child.material.metalnessMap = orig.metalnessMap;
              child.material.opacity = orig.opacity;
              child.material.transparent = orig.transparent;
              if ('roughness' in child.material) child.material.roughness = orig.roughness;
              if ('metalness' in child.material) child.material.metalness = orig.metalness;
              child.material.needsUpdate = true;
            }
          }
        }
      });
    }
  }, [nervous, activeOrgan, hoveredOrgan, hoveredMeshName, highlightedOrgans]);

  return (
    <primitive
      object={nervous.scene}
      onPointerMove={(e) => handlePointerMove(e, setHoveredMeshName, onHoverOrgan)}
      onPointerOut={(e) => handlePointerOut(e, setHoveredMeshName, onHoverOrgan)}
      onClick={(e) => handlePointerClick(e, onSelectOrgan)}
    />
  );
}

// 5. Heart Color Matcher (Loads Cardio.glb on-demand only when Cardio is enabled to copy colors)
function HeartColorMatcher({ heartScene, originalMaterialsRef }) {
  const cardio = useGLTF('./Cardiovascular_system.glb');
  useEffect(() => {
    if (heartScene && cardio && cardio.scene) {
      heartScene.traverse((child) => {
        if (child.isMesh) {
          cardio.scene.traverse((cardioChild) => {
            if (cardioChild.isMesh && cardioChild.name === child.name && cardioChild.material && cardioChild.material.color) {
              child.material.color.copy(cardioChild.material.color);
              
              const cacheKey = `heart_${child.uuid}`;
              const orig = originalMaterialsRef.current.get(cacheKey);
              if (orig) {
                orig.color.copy(cardioChild.material.color);
              }
            }
          });
        }
      });
    }
  }, [heartScene, cardio, originalMaterialsRef]);
  return null;
}

// 6. Heart Model (Lazy-loaded, manages its own heartbeat vertex shader & custom depth)
function HeartPrimitive({ showCardio, activeOrgan, hoveredOrgan, hoveredMeshName, setHoveredMeshName, onSelectOrgan, onHoverOrgan, highlightedOrgans, heartbeatActive, heartbeatBpm }) {
  const heart = useGLTF('./Heart.glb');
  const originalMaterialsRef = useRef(new Map());
  const heartbeatPhaseRef = useRef(0);
  const heartCenterRef = useRef(new THREE.Vector3());
  const heartYMinRef = useRef(-0.1);
  const heartYMaxRef = useRef(0.1);
  const needsResetRef = useRef(false);

  useFrame((state, delta) => {
    if (heartbeatActive) {
      const bps = heartbeatBpm / 60;
      heartbeatPhaseRef.current += delta * bps;
      const p = heartbeatPhaseRef.current % 1.0;

      let atriaScale = 1.0;
      let ventricleScale = 1.0;

      if (p < 0.15) {
        const pAtria = p / 0.15;
        atriaScale = 1.0 - 0.08 * Math.sin(pAtria * Math.PI);
        ventricleScale = 1.0 + 0.02 * Math.sin(pAtria * Math.PI);
      } else if (p >= 0.15 && p < 0.50) {
        const pVent = (p - 0.15) / 0.35;
        ventricleScale = 1.0 - 0.14 * Math.sin(pVent * Math.PI);
        atriaScale = 1.0 + 0.03 * Math.sin(pVent * Math.PI);
      }

      let jiggle = 0;
      if (p >= 0.18 && p < 0.33) {
        const d = p - 0.18;
        jiggle += 0.015 * Math.exp(-25 * d) * Math.sin(60 * Math.PI * d);
      }
      if (p >= 0.50 && p < 0.70) {
        const d = p - 0.50;
        jiggle += 0.012 * Math.exp(-20 * d) * Math.sin(50 * Math.PI * d);
      }

      needsResetRef.current = true;

      if (heart.scene) {
        heart.scene.updateWorldMatrix(true, true);
        const sceneWorldInverse = new THREE.Matrix4().copy(heart.scene.matrixWorld).invert();

        heart.scene.traverse((child) => {
          if (child.isMesh) {
            const cacheKey = `heart_${child.uuid}`;
            const orig = originalMaterialsRef.current.get(cacheKey);
            if (orig && orig.position) {
              child.position.copy(orig.position);
              child.scale.set(1, 1, 1);
            }

            if (child.material && child.material.userData && child.material.userData.uDeformEnabled) {
              const ud = child.material.userData;
              ud.uVentricleScale.value = ventricleScale;
              ud.uAtriaScale.value = atriaScale;
              ud.uJiggle.value = jiggle;

              const localToHeart = new THREE.Matrix4()
                .copy(sceneWorldInverse)
                .multiply(child.matrixWorld);
              ud.uLocalToHeartMatrix.value.copy(localToHeart);

              const heartToLocal = new THREE.Matrix4().copy(localToHeart).invert();
              ud.uHeartToLocalMatrix.value.copy(heartToLocal);

              ud.uHeartCenter.value.copy(heartCenterRef.current);
              ud.uYMin.value = heartYMinRef.current;
              ud.uYMax.value = heartYMaxRef.current;

              const nameLower = child.name.toLowerCase();
              const isRightAtrium = nameLower.includes('right atrium');
              const isTrunkOrSinus = 
                nameLower.includes('pulmonary trunk') || 
                nameLower.includes('bifurcation') || 
                nameLower.includes('coronary sinus');

              ud.uDeformEnabled.value = isRightAtrium ? 0.05 : (isTrunkOrSinus ? 0.15 : 1.0);
            }
          }
        });
      }
    } else {
      if (needsResetRef.current && heart.scene) {
        heart.scene.traverse((child) => {
          if (child.isMesh && child.material && child.material.userData && child.material.userData.uDeformEnabled) {
            child.material.userData.uDeformEnabled.value = 0.0;
          }
        });
        needsResetRef.current = false;
      }
    }
  });

  useEffect(() => {
    if (heart && heart.scene) {
      heart.scene.traverse((c) => {
        c.updateMatrix();
      });

      const combinedBox = new THREE.Box3();
      heart.scene.traverse((child) => {
        if (child.isMesh) {
          const localToHeart = new THREE.Matrix4();
          let curr = child;
          while (curr && curr !== heart.scene) {
            localToHeart.premultiply(curr.matrix);
            curr = curr.parent;
          }
          
          const posAttr = child.geometry.attributes.position;
          const count = posAttr.count;
          const tempV = new THREE.Vector3();
          
          for (let i = 0; i < count; i++) {
            tempV.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            tempV.applyMatrix4(localToHeart);
            combinedBox.expandByPoint(tempV);
          }
        }
      });

      combinedBox.getCenter(heartCenterRef.current);
      heartYMinRef.current = combinedBox.min.y - heartCenterRef.current.y;
      heartYMaxRef.current = combinedBox.max.y - heartCenterRef.current.y;

      heart.scene.traverse((child) => {
        if (child.isMesh) {
          const cacheKey = `heart_${child.uuid}`;
          if (!originalMaterialsRef.current.has(cacheKey)) {
            const originalMat = child.material;
            const clonedMat = originalMat.clone();
            clonedMat.side = THREE.FrontSide;

            const localToHeart = new THREE.Matrix4();
            let curr = child;
            while (curr && curr !== heart.scene) {
              localToHeart.premultiply(curr.matrix);
              curr = curr.parent;
            }

            const heartToLocal = new THREE.Matrix4().copy(localToHeart).invert();

            const posAttr = child.geometry.attributes.position;
            const count = posAttr.count;

            const originalLocalVertices = new Float32Array(posAttr.array);
            const originalVerticesHeartSpace = new Float32Array(count * 3);

            for (let i = 0; i < count; i++) {
              const x = posAttr.getX(i);
              const y = posAttr.getY(i);
              const z = posAttr.getZ(i);
              const v = new THREE.Vector3(x, y, z).applyMatrix4(localToHeart);
              originalVerticesHeartSpace[i * 3] = v.x;
              originalVerticesHeartSpace[i * 3 + 1] = v.y;
              originalVerticesHeartSpace[i * 3 + 2] = v.z;
            }

            const worldPos = new THREE.Vector3();
            child.getWorldPosition(worldPos);
            const heartLocalPos = new THREE.Vector3().copy(worldPos);
            heart.scene.worldToLocal(heartLocalPos);

            clonedMat.userData.uHeartCenter = { value: new THREE.Vector3().copy(heartCenterRef.current) };
            clonedMat.userData.uYMin = { value: heartYMinRef.current };
            clonedMat.userData.uYMax = { value: heartYMaxRef.current };
            clonedMat.userData.uVentricleScale = { value: 1.0 };
            clonedMat.userData.uAtriaScale = { value: 1.0 };
            clonedMat.userData.uJiggle = { value: 0.0 };
            clonedMat.userData.uLocalToHeartMatrix = { value: new THREE.Matrix4().copy(localToHeart) };
            clonedMat.userData.uHeartToLocalMatrix = { value: new THREE.Matrix4().copy(heartToLocal) };
            clonedMat.userData.uDeformEnabled = { value: 0.0 };

            clonedMat.customProgramCacheKey = () => `deform_${child.uuid}`;
            clonedMat.onBeforeCompile = (shader) => {
              shader.uniforms.uHeartCenter = clonedMat.userData.uHeartCenter;
              shader.uniforms.uYMin = clonedMat.userData.uYMin;
              shader.uniforms.uYMax = clonedMat.userData.uYMax;
              shader.uniforms.uVentricleScale = clonedMat.userData.uVentricleScale;
              shader.uniforms.uAtriaScale = clonedMat.userData.uAtriaScale;
              shader.uniforms.uJiggle = clonedMat.userData.uJiggle;
              shader.uniforms.uLocalToHeartMatrix = clonedMat.userData.uLocalToHeartMatrix;
              shader.uniforms.uHeartToLocalMatrix = clonedMat.userData.uHeartToLocalMatrix;
              shader.uniforms.uDeformEnabled = clonedMat.userData.uDeformEnabled;

              shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                 uniform vec3 uHeartCenter;
                 uniform float uYMin;
                 uniform float uYMax;
                 uniform float uVentricleScale;
                 uniform float uAtriaScale;
                 uniform float uJiggle;
                 uniform mat4 uLocalToHeartMatrix;
                 uniform mat4 uHeartToLocalMatrix;
                 uniform float uDeformEnabled;
                `
              );
              shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                 if (uDeformEnabled > 0.0) {
                   vec4 posHeart = uLocalToHeartMatrix * vec4(position, 1.0);
                   vec3 uVec = posHeart.xyz - uHeartCenter;
                   float hRange = uYMax - uYMin;
                   float h = hRange > 0.001 ? (posHeart.y - uHeartCenter.y - uYMin) / hRange : 0.5;
                   float clampedH = clamp(h, 0.0, 1.0);
                   
                   float ventricleInfluence = (1.0 - clampedH) * (1.0 - clampedH);
                   float atriaInfluence = clampedH * clampedH;
                   
                   float ventricleDev = uVentricleScale - 1.0;
                   float atriaDev = uAtriaScale - 1.0;
                   float baseScaleDev = ventricleDev * ventricleInfluence + atriaDev * atriaInfluence;
                   
                   float envelope = 1.0;
                   if (clampedH > 0.4) {
                     float t = (clampedH - 0.4) / 0.6;
                     envelope = 1.0 - t * t * (3.0 - 2.0 * t);
                   }
                   
                   float factor = 1.0 + (baseScaleDev + uJiggle) * envelope * uDeformEnabled;
                   vec3 deformedPosHeart = uHeartCenter + uVec * factor;
                   vec4 deformedLocal = uHeartToLocalMatrix * vec4(deformedPosHeart, 1.0);
                   transformed = deformedLocal.xyz;
                 }
                `
              );
            };

            const depthMat = new THREE.MeshDepthMaterial({
              depthPacking: THREE.RGBADepthPacking
            });
            depthMat.userData.uHeartCenter = clonedMat.userData.uHeartCenter;
            depthMat.userData.uYMin = depthMat.userData.uYMin;
            depthMat.userData.uYMax = depthMat.userData.uYMax;
            depthMat.userData.uVentricleScale = depthMat.userData.uVentricleScale;
            depthMat.userData.uAtriaScale = depthMat.userData.uAtriaScale;
            depthMat.userData.uJiggle = depthMat.userData.uJiggle;
            depthMat.userData.uLocalToHeartMatrix = depthMat.userData.uLocalToHeartMatrix;
            depthMat.userData.uHeartToLocalMatrix = depthMat.userData.uHeartToLocalMatrix;
            depthMat.userData.uDeformEnabled = depthMat.userData.uDeformEnabled;

            depthMat.customProgramCacheKey = () => `deform_depth_${child.uuid}`;
            depthMat.onBeforeCompile = (shader) => {
              shader.uniforms.uHeartCenter = depthMat.userData.uHeartCenter;
              shader.uniforms.uYMin = depthMat.userData.uYMin;
              shader.uniforms.uYMax = depthMat.userData.uYMax;
              shader.uniforms.uVentricleScale = depthMat.userData.uVentricleScale;
              shader.uniforms.uAtriaScale = depthMat.userData.uAtriaScale;
              shader.uniforms.uJiggle = depthMat.userData.uJiggle;
              shader.uniforms.uLocalToHeartMatrix = depthMat.userData.uLocalToHeartMatrix;
              shader.uniforms.uHeartToLocalMatrix = depthMat.userData.uHeartToLocalMatrix;
              shader.uniforms.uDeformEnabled = depthMat.userData.uDeformEnabled;

              shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                 uniform vec3 uHeartCenter;
                 uniform float uYMin;
                 uniform float uYMax;
                 uniform float uVentricleScale;
                 uniform float uAtriaScale;
                 uniform float uJiggle;
                 uniform mat4 uLocalToHeartMatrix;
                 uniform mat4 uHeartToLocalMatrix;
                 uniform float uDeformEnabled;
                `
              );
              shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                 if (uDeformEnabled > 0.0) {
                   vec4 posHeart = uLocalToHeartMatrix * vec4(position, 1.0);
                   vec3 uVec = posHeart.xyz - uHeartCenter;
                   float hRange = uYMax - uYMin;
                   float h = hRange > 0.001 ? (posHeart.y - uHeartCenter.y - uYMin) / hRange : 0.5;
                   float clampedH = clamp(h, 0.0, 1.0);
                   
                   float ventricleInfluence = (1.0 - clampedH) * (1.0 - clampedH);
                   float atriaInfluence = clampedH * clampedH;
                   
                   float ventricleDev = uVentricleScale - 1.0;
                   float atriaDev = uAtriaScale - 1.0;
                   float baseScaleDev = ventricleDev * ventricleInfluence + atriaDev * atriaInfluence;
                   
                   float envelope = 1.0;
                   if (clampedH > 0.4) {
                     float t = (clampedH - 0.4) / 0.6;
                     envelope = 1.0 - t * t * (3.0 - 2.0 * t);
                   }
                   
                   float factor = 1.0 + (baseScaleDev + uJiggle) * envelope * uDeformEnabled;
                   vec3 deformedPosHeart = uHeartCenter + uVec * factor;
                   vec4 deformedLocal = uHeartToLocalMatrix * vec4(deformedPosHeart, 1.0);
                   transformed = deformedLocal.xyz;
                 }
                `
              );
            };
            child.customDepthMaterial = depthMat;

            originalMaterialsRef.current.set(cacheKey, {
              color: clonedMat.color.clone(),
              position: child.position.clone(),
              heartLocalPosition: heartLocalPos,
              localToHeart: localToHeart,
              heartToLocal: heartToLocal,
              originalLocalVertices: originalLocalVertices,
              originalVerticesHeartSpace: originalVerticesHeartSpace,
              map: originalMat.map || null,
              normalMap: originalMat.normalMap || null,
              bumpMap: originalMat.bumpMap || null,
              roughnessMap: originalMat.roughnessMap || null,
              metalnessMap: originalMat.metalnessMap || null,
              roughness: clonedMat.roughness ?? 0.7,
              metalness: clonedMat.metalness ?? 0.1,
              opacity: originalMat.opacity ?? 1.0,
              transparent: originalMat.transparent ?? false
            });
            child.material = clonedMat;
          }
        }
      });
    }
  }, [heart]);

  useEffect(() => {
    if (heart && heart.scene) {
      heart.scene.traverse((child) => {
        if (child.isMesh) {
          const isSelected = child.name === activeOrgan || highlightedOrgans.includes(child.name) || shareParentRegion(child.name, activeOrgan);
          const isHovered = child.name === hoveredOrgan || child.name === hoveredMeshName || shareParentRegion(child.name, hoveredOrgan) || shareParentRegion(child.name, hoveredMeshName);
          const orig = originalMaterialsRef.current.get(`heart_${child.uuid}`);

          if (isSelected) {
            child.material.color.set('#3b82f6');
            child.material.map = null;
            child.material.normalMap = null;
            child.material.bumpMap = null;
            child.material.roughnessMap = null;
            child.material.metalnessMap = null;
            child.material.opacity = 1.0;
            child.material.transparent = false;
            if ('roughness' in child.material) child.material.roughness = 0.4;
            if ('metalness' in child.material) child.material.metalness = 0.2;
            child.material.needsUpdate = true;
          } else if (isHovered) {
            child.material.color.set('#cbd5e1');
            child.material.map = null;
            child.material.normalMap = null;
            child.material.bumpMap = null;
            child.material.roughnessMap = null;
            child.material.metalnessMap = null;
            child.material.opacity = 0.95;
            child.material.transparent = true;
            if ('roughness' in child.material) child.material.roughness = 0.6;
            if ('metalness' in child.material) child.material.metalness = 0.1;
            child.material.needsUpdate = true;
          } else {
            if (orig) {
              child.material.color.copy(orig.color);
              child.material.map = orig.map;
              child.material.normalMap = orig.normalMap;
              child.material.bumpMap = orig.bumpMap;
              child.material.roughnessMap = orig.roughnessMap;
              child.material.metalnessMap = orig.metalnessMap;
              child.material.opacity = orig.opacity;
              child.material.transparent = orig.transparent;
              if ('roughness' in child.material) child.material.roughness = orig.roughness;
              if ('metalness' in child.material) child.material.metalness = orig.metalness;
              child.material.needsUpdate = true;
            }
          }
        }
      });
    }
  }, [heart, activeOrgan, hoveredOrgan, hoveredMeshName, highlightedOrgans]);

  return (
    <group>
      <primitive
        object={heart.scene}
        onPointerMove={(e) => handlePointerMove(e, setHoveredMeshName, onHoverOrgan)}
        onPointerOut={(e) => handlePointerOut(e, setHoveredMeshName, onHoverOrgan)}
        onClick={(e) => handlePointerClick(e, onSelectOrgan)}
      />
      {showCardio && (
        <HeartColorMatcher heartScene={heart.scene} originalMaterialsRef={originalMaterialsRef} />
      )}
    </group>
  );
}

function HeartModel({ showHeart, ...props }) {
  if (!showHeart) return null;
  return <HeartPrimitive {...props} />;
}

// 7. Main Model Renderer (Manages shared rotation, scales, position, and renders sub-models on-demand)
export function Model({ activeOrgan, hoveredOrgan, onSelectOrgan, onHoverOrgan, highlightedOrgans = [], showBody = true, showSkeleton = false, showCardio = false, showHeart = false, showNervous = false, heartbeatActive = false, heartbeatBpm = 72 }) {
  const [hoveredMeshName, setHoveredMeshName] = useState(null);
  const modelRef = useRef();

  // Slow continuous rotation in Y direction (paused when an organ is actively selected)
  useFrame((state, delta) => {
    if (modelRef.current && !activeOrgan) {
      modelRef.current.rotation.x = 0;
      modelRef.current.rotation.z = 0;
      modelRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <group ref={modelRef} scale={1.4} position={[0, -1.2, 0]}>
      <BodyModel
        showBody={showBody}
        activeOrgan={activeOrgan}
        hoveredOrgan={hoveredOrgan}
        hoveredMeshName={hoveredMeshName}
        setHoveredMeshName={setHoveredMeshName}
        onSelectOrgan={onSelectOrgan}
        onHoverOrgan={onHoverOrgan}
        highlightedOrgans={highlightedOrgans}
      />
      <SkeletonModel
        showSkeleton={showSkeleton}
        activeOrgan={activeOrgan}
        hoveredOrgan={hoveredOrgan}
        hoveredMeshName={hoveredMeshName}
        setHoveredMeshName={setHoveredMeshName}
        onSelectOrgan={onSelectOrgan}
        onHoverOrgan={onHoverOrgan}
        highlightedOrgans={highlightedOrgans}
      />
      <CardioModel
        showCardio={showCardio}
        activeOrgan={activeOrgan}
        hoveredOrgan={hoveredOrgan}
        hoveredMeshName={hoveredMeshName}
        setHoveredMeshName={setHoveredMeshName}
        onSelectOrgan={onSelectOrgan}
        onHoverOrgan={onHoverOrgan}
        highlightedOrgans={highlightedOrgans}
      />
      <HeartModel
        showHeart={showHeart}
        showCardio={showCardio}
        activeOrgan={activeOrgan}
        hoveredOrgan={hoveredOrgan}
        hoveredMeshName={hoveredMeshName}
        setHoveredMeshName={setHoveredMeshName}
        onSelectOrgan={onSelectOrgan}
        onHoverOrgan={onHoverOrgan}
        highlightedOrgans={highlightedOrgans}
        heartbeatActive={heartbeatActive}
        heartbeatBpm={heartbeatBpm}
      />
      <NervousModel
        showNervous={showNervous}
        activeOrgan={activeOrgan}
        hoveredOrgan={hoveredOrgan}
        hoveredMeshName={hoveredMeshName}
        setHoveredMeshName={setHoveredMeshName}
        onSelectOrgan={onSelectOrgan}
        onHoverOrgan={onHoverOrgan}
        highlightedOrgans={highlightedOrgans}
      />
    </group>
  );
}

// Pre-load only the default Skeleton model to optimize initial paint
useGLTF.preload('./SkeletonJoints.glb');
