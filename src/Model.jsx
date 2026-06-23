import React, { useRef, useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Model({ activeOrgan, hoveredOrgan, onSelectOrgan, onHoverOrgan, highlightedOrgans = [], showBody = true, showSkeleton = false, showHair = true }) {
  // Load the glTF models from the public directory
  const { scene } = useGLTF('./human_model.glb');
  const skeleton = useGLTF('./SkeletonJoints.glb');
  const [hoveredMeshName, setHoveredMeshName] = useState(null);
  const modelRef = useRef();

  // Slow continuous rotation in Y direction (side-to-side turntable rotation)
  // Paused when an organ is actively selected
  useFrame((state, delta) => {
    if (modelRef.current && !activeOrgan) {
      modelRef.current.rotation.x = 0;
      modelRef.current.rotation.z = 0;
      modelRef.current.rotation.y += delta * 0.15;
    }
  });

  // Store original materials/colors so we can revert them
  const originalMaterialsRef = useRef(new Map());

  useEffect(() => {
    // Initial traversal to save original materials and configure default styling
    scene.traverse((child) => {
      if (child.isMesh) {
        // Save original material if not already saved
        if (!originalMaterialsRef.current.has(child.name)) {
          const originalMat = child.material;
          originalMaterialsRef.current.set(child.name, {
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
  }, [scene, skeleton]);

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
      if (child.isMesh) {
        // Toggle visibility of hair meshes based on showHair state
        const isHair = child.name.startsWith('Hair.');
        if (isHair) {
          child.visible = showHair;
        }

        const isSelected = child.name === activeOrgan || highlightedOrgans.includes(child.name) || shareParentRegion(child.name, activeOrgan);
        const isHovered = child.name === hoveredOrgan || child.name === hoveredMeshName || shareParentRegion(child.name, hoveredOrgan) || shareParentRegion(child.name, hoveredMeshName);
        const orig = originalMaterialsRef.current.get(child.name);

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
  }, [activeOrgan, hoveredOrgan, hoveredMeshName, scene, skeleton, highlightedOrgans, showHair]);

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

  const handlePointerDown = (e) => {
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
          onPointerDown={handlePointerDown}
        />
      )}
      {showSkeleton && (
        <primitive
          object={skeleton.scene}
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
          onPointerDown={handlePointerDown}
        />
      )}
    </group>
  );
}

// Pre-load the glTF files for better responsiveness
useGLTF.preload('./human_model.glb');
useGLTF.preload('./SkeletonJoints.glb');
