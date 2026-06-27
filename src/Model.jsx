import { useRef, useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Model({ activeOrgan, hoveredOrgan, onSelectOrgan, onHoverOrgan, highlightedOrgans = [], showBody = true, showSkeleton = false, showCardio = false, showHeart = false, showNervous = false, heartbeatActive = false, heartbeatBpm = 72 }) {
  // Load the glTF models from the public directory
  const { scene } = useGLTF('./human_model.glb');
  const skeleton = useGLTF('./SkeletonJoints.glb');
  const cardio = useGLTF('./Cardiovascular_system.glb');
  const heart = useGLTF('./Heart.glb');
  const nervous = useGLTF('./Nervous_system.glb');
  const [hoveredMeshName, setHoveredMeshName] = useState(null);
  const modelRef = useRef();
  const heartbeatPhaseRef = useRef(0);
  const heartCenterRef = useRef(new THREE.Vector3());
  const heartYMinRef = useRef(-0.1);
  const heartYMaxRef = useRef(0.1);
  const needsResetRef = useRef(false);

  // Slow continuous rotation in Y direction and elastic heartbeat animation
  useFrame((state, delta) => {
    // 1. Model turntable rotation (paused when an organ is actively selected)
    if (modelRef.current && !activeOrgan) {
      modelRef.current.rotation.x = 0;
      modelRef.current.rotation.z = 0;
      modelRef.current.rotation.y += delta * 0.15;
    }

    // 2. Phased elastic heartbeat animation (sequential chamber contraction + recoil jiggle)
    // ONLY applied to Heart.glb, leaving Cardiovascular system completely static
    if (heartbeatActive) {
      const bps = heartbeatBpm / 60; // Beats per second
      heartbeatPhaseRef.current += delta * bps;
      const p = heartbeatPhaseRef.current % 1.0; // Normalized cardiac cycle phase [0.0, 1.0)

      let atriaScale = 1.0;
      let ventricleScale = 1.0;

      // Phase A: Atrial Systole (Phase 0.0 to 0.15) - Atria contract to pump blood into ventricles
      if (p < 0.15) {
        const pAtria = p / 0.15;
        atriaScale = 1.0 - 0.08 * Math.sin(pAtria * Math.PI);
        ventricleScale = 1.0 + 0.02 * Math.sin(pAtria * Math.PI); // Passive ventricular filling expansion
      }
      // Phase B: Ventricular Systole (Phase 0.15 to 0.50) - Ventricles contract strongly to eject blood
      else if (p >= 0.15 && p < 0.50) {
        const pVent = (p - 0.15) / 0.35;
        ventricleScale = 1.0 - 0.14 * Math.sin(pVent * Math.PI);
        atriaScale = 1.0 + 0.03 * Math.sin(pVent * Math.PI); // Atria relax and refill passively
      }

      // Phase C: Decaying Elastic Recoil Jiggle (Physics-based vibrations on valve closure / muscle contraction)
      let jiggle = 0;
      // 1. Ventricular contraction snap (around p = 0.18)
      if (p >= 0.18 && p < 0.33) {
        const d = p - 0.18;
        jiggle += 0.015 * Math.exp(-25 * d) * Math.sin(60 * Math.PI * d);
      }
      // 2. Valves snap-shut at the start of diastole (around p = 0.50)
      if (p >= 0.50 && p < 0.70) {
        const d = p - 0.50;
        jiggle += 0.012 * Math.exp(-20 * d) * Math.sin(50 * Math.PI * d);
      }

      needsResetRef.current = true;

      const updateHeartUniforms = (sceneObj) => {
        sceneObj.updateWorldMatrix(true, true);
        const sceneWorldInverse = new THREE.Matrix4().copy(sceneObj.matrixWorld).invert();

        sceneObj.traverse((child) => {
          if (child.isMesh) {
            // Keep CPU positions and scales completely static at original coordinates
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

              // Compute and update localToHeart matrix
              const localToHeart = new THREE.Matrix4()
                .copy(sceneWorldInverse)
                .multiply(child.matrixWorld);
              ud.uLocalToHeartMatrix.value.copy(localToHeart);

              // Compute and update heartToLocal matrix
              const heartToLocal = new THREE.Matrix4().copy(localToHeart).invert();
              ud.uHeartToLocalMatrix.value.copy(heartToLocal);

              // Update heart boundaries and center reference
              ud.uHeartCenter.value.copy(heartCenterRef.current);
              ud.uYMin.value = heartYMinRef.current;
              ud.uYMax.value = heartYMaxRef.current;

              // Set the custom deformation constraint
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
      };

      if (showHeart && heart.scene) {
        updateHeartUniforms(heart.scene);
      }
    } else {
      if (needsResetRef.current && showHeart && heart.scene) {
        heart.scene.traverse((child) => {
          if (child.isMesh && child.material && child.material.userData && child.material.userData.uDeformEnabled) {
            child.material.userData.uDeformEnabled.value = 0.0;
          }
        });
        needsResetRef.current = false;
      }
    }
  });

  // Store original materials/colors so we can revert them
  const originalMaterialsRef = useRef(new Map());

  useEffect(() => {
    // Initial traversal to save original materials and configure default styling
    scene.traverse((child) => {
      if (child.isMesh) {
        // Save original material if not already saved
        const cacheKey = `body_${child.name}`;
        if (!originalMaterialsRef.current.has(cacheKey)) {
          const originalMat = child.material;
          originalMaterialsRef.current.set(cacheKey, {
            material: originalMat,
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

          // Clone the material so modifications are independent per mesh and retain original features (e.g. textures)
          child.material = originalMat.clone();
          child.material.side = THREE.FrontSide; // Set to FrontSide to avoid z-fighting shadow acne grid patterns
        }
        
        // Enable shadows
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Configure skeleton scene shadows and material settings
    if (skeleton && skeleton.scene) {
      skeleton.scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Apply a clean matte bone material to fix the black rendering issue
          // We check if the material is already replaced to avoid recreating it
          if (!(child.material instanceof THREE.MeshStandardMaterial) || child.material.name !== 'soma-bone') {
            child.material = new THREE.MeshStandardMaterial({
              name: 'soma-bone',
              color: new THREE.Color('#eae6df'), // Clean, realistic ivory/bone-white
              roughness: 0.8,
              metalness: 0.05,
              side: THREE.DoubleSide // Ensure bones render double-sided for internal inspection
            });
          }
        }
      });
    }

    // Configure cardiovascular scene shadows and material settings
    if (cardio && cardio.scene) {
      cardio.scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          const cacheKey = `cardio_${child.name}`;
          if (!originalMaterialsRef.current.has(cacheKey)) {
            const originalMat = child.material;
            const clonedMat = originalMat.clone();
            clonedMat.side = THREE.FrontSide;
            
            // Colors are now pre-embedded natively in Cardiovascular_system.glb

            originalMaterialsRef.current.set(cacheKey, {
              material: originalMat,
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

    // Configure nervous system scene shadows and material settings
    if (nervous && nervous.scene) {
      nervous.scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          const cacheKey = `nervous_${child.name}`;
          if (!originalMaterialsRef.current.has(cacheKey)) {
            const originalMat = child.material;
            const clonedMat = originalMat.clone();
            clonedMat.side = THREE.FrontSide;

            // Transparency settings for eye parts (cornea, lens, tympanic, vitreous) in cloned material
            const nameLower = child.name.toLowerCase();
            if (nameLower.includes('cornea')) {
              clonedMat.transparent = true;
              clonedMat.opacity = 0.15;
            } else if (nameLower.includes('lens')) {
              clonedMat.transparent = true;
              clonedMat.opacity = 0.4;
            } else if (nameLower.includes('vitreous')) {
              clonedMat.transparent = true;
              clonedMat.opacity = 0.15;
            } else if (nameLower.includes('tympanic')) {
              clonedMat.transparent = true;
              clonedMat.opacity = 0.6;
            } else {
              // Set standard yellow color for nervous system
              clonedMat.color.set('#f59e0b');
            }

            originalMaterialsRef.current.set(cacheKey, {
              material: originalMat,
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

    // Configure heart scene shadows and material settings
    if (heart && heart.scene) {
      // Force update all local matrices in the heart scene to ensure accurate calculations
      heart.scene.traverse((c) => {
        c.updateMatrix();
      });

      // Calculate combined bounding box center of the heart in heart.scene space
      const combinedBox = new THREE.Box3();
      heart.scene.traverse((child) => {
        if (child.isMesh) {
          // Compute localToHeart matrix relative to heart.scene hierarchically
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
      console.log("Heart local center calculated relative to heart.scene (CPU):", heartCenterRef.current);

      // Calculate vertical height range of all meshes relative to center in heart.scene space
      heartYMinRef.current = combinedBox.min.y - heartCenterRef.current.y;
      heartYMaxRef.current = combinedBox.max.y - heartCenterRef.current.y;
      console.log(`Heart height range relative to center (CPU): min=${heartYMinRef.current}, max=${heartYMaxRef.current}`);

      heart.scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          const cacheKey = `heart_${child.uuid}`;
          if (!originalMaterialsRef.current.has(cacheKey)) {
            const originalMat = child.material;
            const clonedMat = originalMat.clone();
            clonedMat.side = THREE.FrontSide;

            // Colors are now pre-embedded natively in Heart.glb

            // Compute localToHeart matrix relative to heart.scene hierarchically
            const localToHeart = new THREE.Matrix4();
            let curr = child;
            while (curr && curr !== heart.scene) {
              localToHeart.premultiply(curr.matrix);
              curr = curr.parent;
            }

            const heartToLocal = new THREE.Matrix4().copy(localToHeart).invert();

            // Cache original vertex positions
            const posAttr = child.geometry.attributes.position;
            const count = posAttr.count;

            const originalLocalVertices = new Float32Array(posAttr.array);
            const originalVerticesHeartSpace = new Float32Array(count * 3);

            for (let i = 0; i < count; i++) {
              const x = posAttr.getX(i);
              const y = posAttr.getY(i);
              const z = posAttr.getZ(i);
              // Transform to heart space
              const v = new THREE.Vector3(x, y, z).applyMatrix4(localToHeart);
              originalVerticesHeartSpace[i * 3] = v.x;
              originalVerticesHeartSpace[i * 3 + 1] = v.y;
              originalVerticesHeartSpace[i * 3 + 2] = v.z;
            }

            const worldPos = new THREE.Vector3();
            child.getWorldPosition(worldPos);
            const heartLocalPos = new THREE.Vector3().copy(worldPos);
            heart.scene.worldToLocal(heartLocalPos);

            // Add GPU Vertex Shader deformation to material using onBeforeCompile
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

            // Setup customDepthMaterial for dynamic shadow casting matching deformation
            const depthMat = new THREE.MeshDepthMaterial({
              depthPacking: THREE.RGBADepthPacking
            });
            depthMat.userData.uHeartCenter = clonedMat.userData.uHeartCenter;
            depthMat.userData.uYMin = clonedMat.userData.uYMin;
            depthMat.userData.uYMax = clonedMat.userData.uYMax;
            depthMat.userData.uVentricleScale = clonedMat.userData.uVentricleScale;
            depthMat.userData.uAtriaScale = clonedMat.userData.uAtriaScale;
            depthMat.userData.uJiggle = clonedMat.userData.uJiggle;
            depthMat.userData.uLocalToHeartMatrix = clonedMat.userData.uLocalToHeartMatrix;
            depthMat.userData.uHeartToLocalMatrix = clonedMat.userData.uHeartToLocalMatrix;
            depthMat.userData.uDeformEnabled = clonedMat.userData.uDeformEnabled;

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
              material: originalMat,
              color: clonedMat.color.clone(),
              position: child.position.clone(), // Cache original position
              heartLocalPosition: heartLocalPos, // Cache original position relative to heart.scene
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
  }, [scene, skeleton, cardio, heart, nervous]);

  // Update materials based on hover and selection state
  useEffect(() => {
    const shareParentRegion = (name1, name2) => {
      if (!name1 || !name2) return false;
      const base1 = name1.split('.').slice(0, 2).join('.').toLowerCase();
      const base2 = name2.split('.').slice(0, 2).join('.').toLowerCase();
      return base1 === base2;
    };

    // 1. Update Body scene materials
    scene.traverse((child) => {
      // Hide hair meshes/groups permanently
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
          // Selected state: Medium-dark corporate blue (solid color)
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
          // Hovered state: Soft light blue (solid color)
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
          // Normal state: Revert to actual body color and restore original GLB textures
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

    // 2. Update Skeleton scene materials
    if (skeleton && skeleton.scene) {
      skeleton.scene.traverse((child) => {
        if (child.isMesh) {
          const isSelected = child.name === activeOrgan || highlightedOrgans.includes(child.name) || shareParentRegion(child.name, activeOrgan);
          const isHovered = child.name === hoveredOrgan || child.name === hoveredMeshName || shareParentRegion(child.name, hoveredOrgan) || shareParentRegion(child.name, hoveredMeshName);

          if (isSelected) {
            // Selected state for bones: Medium-dark corporate blue (solid color)
            child.material.color.set('#3b82f6');
            child.material.opacity = 1.0;
            child.material.transparent = false;
            child.material.roughness = 0.4;
            child.material.metalness = 0.2;
            child.material.needsUpdate = true;
          } else if (isHovered) {
            // Hovered state for bones: Soft light blue (solid color)
            child.material.color.set('#cbd5e1');
            child.material.opacity = 0.95;
            child.material.transparent = true;
            child.material.roughness = 0.6;
            child.material.metalness = 0.1;
            child.material.needsUpdate = true;
          } else {
            // Normal bone state: Clean matte bone-white
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

    // 3. Update Cardiovascular scene materials
    if (cardio && cardio.scene) {
      cardio.scene.traverse((child) => {
        if (child.isMesh) {
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

    // 4. Update Heart scene materials
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
    // 5. Update Nervous scene materials
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
  }, [activeOrgan, hoveredOrgan, hoveredMeshName, scene, skeleton, cardio, heart, nervous, highlightedOrgans]);

  // Handle pointer interactions
  const handlePointerMove = (e) => {
    e.stopPropagation();
    if (e.face && e.object && e.object.isMesh) {
      const meshName = e.object.name;
      if (meshName !== hoveredMeshName) {
        setHoveredMeshName(meshName);
        if (onHoverOrgan) onHoverOrgan(meshName);
      }
    }
  };

  const handlePointerOut = (e) => {
    e.stopPropagation();
    setHoveredMeshName(null);
    if (onHoverOrgan) onHoverOrgan(null);
  };

  const handlePointerClick = (e) => {
    e.stopPropagation();
    if (e.object && e.object.isMesh) {
      const meshName = e.object.name;
      if (onSelectOrgan) {
        onSelectOrgan(meshName);
      }
    }
  };

  return (
    <group ref={modelRef} scale={1.4} position={[0, -1.2, 0]}>
      {showBody && (
        <primitive
          object={scene}
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
          onClick={handlePointerClick}
        />
      )}
      {showSkeleton && (
        <primitive
          object={skeleton.scene}
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
          onClick={handlePointerClick}
        />
      )}
      {showCardio && (
        <group name="cardio-group">
          <primitive
            object={cardio.scene}
            onPointerMove={handlePointerMove}
            onPointerOut={handlePointerOut}
            onClick={handlePointerClick}
          />
        </group>
      )}
      {showHeart && (
        <group name="heart-group">
          <primitive
            object={heart.scene}
            onPointerMove={handlePointerMove}
            onPointerOut={handlePointerOut}
            onClick={handlePointerClick}
          />
        </group>
      )}
      {showNervous && (
        <group name="nervous-group">
          <primitive
            object={nervous.scene}
            onPointerMove={handlePointerMove}
            onPointerOut={handlePointerOut}
            onClick={handlePointerClick}
          />
        </group>
      )}
    </group>
  );
}

// Pre-load the glTF files for better responsiveness
useGLTF.preload('./human_model.glb');
useGLTF.preload('./SkeletonJoints.glb');
useGLTF.preload('./Cardiovascular_system.glb');
useGLTF.preload('./Heart.glb');
useGLTF.preload('./Nervous_system.glb');
