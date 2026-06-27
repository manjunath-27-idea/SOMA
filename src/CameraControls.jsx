import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function CameraControls({ activeOrgan, highlightedOrgans = [], zoomToWholeTour = false, tourRegions = [], showHeart = false, showCardio = false }) {
  const { camera, scene, controls } = useThree();
  
  // Track target positions for interpolation
  const targetPos = useRef(new THREE.Vector3(0, 0, 5));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  // Count remaining transition frames
  const framesRemaining = useRef(0);

  useEffect(() => {
    // Start/restart the transition animation (60 frames, approx. 1 second at 60fps)
    framesRemaining.current = 60;

    if (zoomToWholeTour && tourRegions.length > 0) {
      // Zoom out to show all regions in the tour combined (e.g. the entire arm/head system)
      let targetMeshes = [];
      const allKeys = tourRegions.flatMap(r => r.keys);
      scene.traverse((child) => {
        if (child.isMesh && allKeys.includes(child.name)) {
          targetMeshes.push(child);
        }
      });

      if (targetMeshes.length > 0) {
        const combinedBox = new THREE.Box3();
        targetMeshes.forEach((mesh, index) => {
          const box = new THREE.Box3().setFromObject(mesh);
          if (index === 0) {
            combinedBox.copy(box);
          } else {
            combinedBox.union(box);
          }
        });

        const center = new THREE.Vector3();
        combinedBox.getCenter(center);
        
        const size = new THREE.Vector3();
        combinedBox.getSize(size);
        
        // Determine camera distance based on box size
        const maxDim = Math.max(size.x, size.y, size.z);
        const fovRad = camera.fov * (Math.PI / 180);
        let distance = Math.abs(maxDim / Math.sin(fovRad / 2));

        // Center on vertical axis
        targetLookAt.current.set(0, center.y, 0);
        distance = Math.max(distance * 1.2, 1.2);
        targetPos.current.set(0, center.y + 0.1, distance);
      }
      return;
    }

    const isHeartModelMesh = (child) => {
      let temp = child;
      while (temp) {
        if (temp.name === 'heart-group') return true;
        temp = temp.parent;
      }
      return false;
    };

    if (!activeOrgan && (!highlightedOrgans || highlightedOrgans.length === 0)) {
      if (showHeart) {
        // Zoom camera to focus on the Heart model dynamically
        let targetMeshes = [];
        scene.traverse((child) => {
          if (child.isMesh && isHeartModelMesh(child)) {
            targetMeshes.push(child);
          }
        });

        if (targetMeshes.length > 0) {
          const combinedBox = new THREE.Box3();
          targetMeshes.forEach((mesh, index) => {
            const box = new THREE.Box3().setFromObject(mesh);
            if (index === 0) {
              combinedBox.copy(box);
            } else {
              combinedBox.union(box);
            }
          });

          const center = new THREE.Vector3();
          combinedBox.getCenter(center);
          
          const size = new THREE.Vector3();
          combinedBox.getSize(size);
          
          const maxDim = Math.max(size.x, size.y, size.z);
          const fovRad = camera.fov * (Math.PI / 180);
          let distance = Math.abs(maxDim / Math.sin(fovRad / 2));

          targetLookAt.current.copy(center);
          distance = Math.max(distance * 0.7, 0.7);
          targetPos.current.set(0, center.y + 0.05, distance);
          return;
        }
      }

      // Default camera state: Reset back to viewing the entire body
      // On mobile, zoom out slightly (z = 5.5) to prevent vertical clipping on narrow screens
      const defaultZ = (typeof window !== 'undefined' && window.innerWidth < 768) ? 5.5 : 4.5;
      targetPos.current.set(0, 0, defaultZ);
      targetLookAt.current.set(0, -0.2, 0);
      return;
    }

    // Traverse the scene to locate the target meshes
    let targetMeshes = [];
    const shareParent = (name1, name2) => {
      if (!name1 || !name2) return false;
      const base1 = name1.split('.').slice(0, 2).join('.').toLowerCase();
      const base2 = name2.split('.').slice(0, 2).join('.').toLowerCase();
      return base1 === base2;
    };
    scene.traverse((child) => {
      if (child.isMesh) {
        if (activeOrgan && (child.name === activeOrgan || shareParent(child.name, activeOrgan))) {
          targetMeshes.push(child);
        } else if (!activeOrgan && highlightedOrgans && highlightedOrgans.includes(child.name)) {
          targetMeshes.push(child);
        }
      }
    });

    if (targetMeshes.length > 0) {
      // Calculate combined bounding box of all target meshes
      const combinedBox = new THREE.Box3();
      targetMeshes.forEach((mesh, index) => {
        const box = new THREE.Box3().setFromObject(mesh);
        if (index === 0) {
          combinedBox.copy(box);
        } else {
          combinedBox.union(box);
        }
      });

      const center = new THREE.Vector3();
      combinedBox.getCenter(center);
      
      const size = new THREE.Vector3();
      combinedBox.getSize(size);
      
      // Determine camera distance based on box size
      const maxDim = Math.max(size.x, size.y, size.z);
      const fovRad = camera.fov * (Math.PI / 180);
      let distance = Math.abs(maxDim / Math.sin(fovRad / 2));

      const isHeartMesh = (name) => {
        if (!name) return false;
        const lower = name.toLowerCase();
        return (
          lower.includes('heart') ||
          lower.includes('atrium') ||
          lower.includes('ventricle') ||
          lower.includes('coronary') ||
          lower.includes('valve') ||
          lower.includes('leaflet') ||
          lower.includes('cusp') ||
          lower.includes('papillary') ||
          lower.includes('septum') ||
          lower.includes('circumflex') ||
          lower.includes('interventricular') ||
          lower.includes('myocardium') ||
          lower.includes('cardiac') ||
          lower.includes('auricle') ||
          lower.includes('mitral') ||
          lower.includes('tricuspid') ||
          lower.includes('chordae') ||
          lower.includes('atrioventricular') ||
          lower.includes('trabeculae') ||
          lower.includes('marginal')
        );
      };

      if (activeOrgan) {
        // Single organ zoom
        targetLookAt.current.copy(center);
        const isHeart = isHeartMesh(activeOrgan);
        const multiplier = isHeart ? 0.75 : 1.5;
        distance = Math.max(distance * multiplier, isHeart ? 0.35 : 0.6);
        
        // Determine the direction vector from the body center axis to the mesh center in the horizontal X-Z plane
        const dir = new THREE.Vector3(0, 0, 1);
        const horizontalDist = Math.sqrt(center.x * center.x + center.z * center.z);
        if (horizontalDist > 0.05) {
          dir.set(center.x, 0, center.z).normalize();
        }

        // Position the camera along the direction vector from the mesh center
        targetPos.current.copy(center).addScaledVector(dir, distance);
        targetPos.current.y += maxDim * 0.2;
      } else {
        // Multiple organs (system) zoom
        const isHeartSystem = highlightedOrgans.length > 0 && highlightedOrgans.every(name => isHeartMesh(name));
        
        if (isHeartSystem) {
          // Center controls directly on the heart for nice close-up orbital viewing
          targetLookAt.current.copy(center);
          distance = Math.max(distance * 0.7, 0.7);
          targetPos.current.set(0, center.y + 0.05, distance);
        } else {
          // Center the camera targets on the vertical axis (x=0, z=0) to ensure turntable rotation remains smooth and centered!
          targetLookAt.current.set(0, center.y, 0);
          distance = Math.max(distance * 1.2, 1.2);
          targetPos.current.set(0, center.y + 0.1, distance);
        }
      }
    }
  }, [activeOrgan, highlightedOrgans, zoomToWholeTour, tourRegions, scene, camera, showHeart, showCardio]);

  useFrame(() => {
    // Only lerp the camera position and target during the transition window
    if (framesRemaining.current > 0) {
      // Smoothly interpolate the camera position (lerp)
      camera.position.lerp(targetPos.current, 0.08);

      // Smoothly interpolate the orbit controls focus target
      if (controls) {
        controls.target.lerp(targetLookAt.current, 0.08);
        controls.update();
      }
      framesRemaining.current -= 1;
    }
  });

  return null;
}
