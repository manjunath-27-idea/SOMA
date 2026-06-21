import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function CameraControls({ activeOrgan, highlightedOrgans = [] }) {
  const { camera, scene, controls } = useThree();
  
  // Track target positions for interpolation
  const targetPos = useRef(new THREE.Vector3(0, 0, 5));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  // Count remaining transition frames
  const framesRemaining = useRef(0);

  useEffect(() => {
    // Start/restart the transition animation (60 frames, approx. 1 second at 60fps)
    framesRemaining.current = 60;

    if (!activeOrgan && (!highlightedOrgans || highlightedOrgans.length === 0)) {
      // Default camera state: Reset back to viewing the entire body
      targetPos.current.set(0, 0, 4.5);
      targetLookAt.current.set(0, -0.2, 0);
      return;
    }

    // Traverse the scene to locate the target meshes
    let targetMeshes = [];
    scene.traverse((child) => {
      if (child.isMesh) {
        if (activeOrgan && child.name === activeOrgan) {
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

      if (activeOrgan) {
        // Single organ zoom
        targetLookAt.current.copy(center);
        distance = Math.max(distance * 1.5, 0.6);
        
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
        // Center the camera targets on the vertical axis (x=0, z=0) to ensure turntable rotation remains smooth and centered!
        targetLookAt.current.set(0, center.y, 0);
        
        // Slightly pad distance for a nice framing
        distance = Math.max(distance * 1.2, 1.2);
        
        // Place camera directly in front at the calculated height and distance
        targetPos.current.set(0, center.y + 0.1, distance);
      }
    }
  }, [activeOrgan, highlightedOrgans, scene, camera]);

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
