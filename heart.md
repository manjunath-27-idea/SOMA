# SOMA Heartbeat Animation: Mathematical & GPU Implementation

This document describes the mathematical equations and vertex shader architecture used to simulate a biologically accurate heartbeat on the 3D heart model in SOMA.

---

## 1. The Cardiac Cycle: Phase and Scale Equations

The heartbeat animation is driven by a time-delta accumulated phase variable $\phi$, which maps the cardiac cycle to a normalized interval $[0, 1)$:

$$\phi = (t \cdot \text{BPS}) \pmod{1}$$

where $\text{BPS} = \frac{\text{BPM}}{60}$ is Beats Per Second (typically 1.2 BPS for a resting rate of 72 BPM).

### A. Atrial Systole (Atrial Contraction)
When $\phi < 0.15$, the atria contract to push blood into the ventricles. The ventricles expand slightly to accommodate the blood volume (preload):

$$S_{\text{atria}}(\phi) = 1.0 - 0.08 \sin\left(\frac{\phi}{0.15} \pi\right)$$

$$S_{\text{ventricle}}(\phi) = 1.0 + 0.02 \sin\left(\frac{\phi}{0.15} \pi\right)$$

### B. Ventricular Systole (Ventricular Contraction)
When $0.15 \le \phi < 0.50$, the ventricles contract strongly to pump blood to the lungs and body. The atria relax and expand:

$$S_{\text{ventricle}}(\phi) = 1.0 - 0.14 \sin\left(\frac{\phi - 0.15}{0.35} \pi\right)$$

$$S_{\text{atria}}(\phi) = 1.0 + 0.03 \sin\left(\frac{\phi - 0.15}{0.35} \pi\right)$$

### C. Diastole & Valve Rebound (Jiggle Oscillations)
To simulate the physical shockwaves created by the closure of the heart valves (S1 and S2 heart sounds), we apply damped harmonic oscillations ($J$) during transition phases:

1.  **S1 Valve Closure (Atrioventricular Valves):** Triggered during ventricular contraction ($0.18 \le \phi < 0.33$):
    $$J_1(\phi) = 0.015 \cdot e^{-25(\phi - 0.18)} \sin\left(60 \pi (\phi - 0.18)\right)$$

2.  **S2 Valve Closure (Semilunar Valves):** Triggered at the beginning of relaxation/diastole ($0.50 \le \phi < 0.70$):
    $$J_2(\phi) = 0.012 \cdot e^{-20(\phi - 0.50)} \sin\left(50 \pi (\phi - 0.50)\right)$$

The combined jiggle factor is $J(\phi) = J_1(\phi) + J_2(\phi)$.

---

## 2. GPU Vertex Shader Deformation Pipeline

Instead of using CPU-heavy morph targets or bone weights, SOMA deforms the 3D heart meshes dynamically in the GPU using a **custom WebGL vertex shader** injected via Three.js `onBeforeCompile`.

### A. Coordinate Space Normalization
For every vertex, the local vertex position $\vec{p}_{\text{local}}$ is transformed into a normalized **"Heart-Space"** coordinates system aligned with the center of the combined heart bounding box:

$$\vec{p}_{\text{heart}} = \mathbf{M}_{\text{local\_to\_heart}} \cdot \vec{p}_{\text{local}}$$

The vertical height $h$ along the Y-axis is normalized between $[0, 1]$ relative to the heart bounds ($Y_{\text{min}}$ to $Y_{\text{max}}$):

$$h = \frac{y_{\text{heart}} - Y_{\text{center}} - Y_{\text{min}}}{Y_{\text{max}} - Y_{\text{min}}}$$

### B. Vertical Influence Masking
To prevent the whole heart from scaling uniformly, quadratic attenuation masks are applied based on the height $h$:
*   **Ventricle Influence (Bottom-heavy):**
    $$I_{\text{ventricle}} = (1.0 - h)^2$$
*   **Atria Influence (Top-heavy):**
    $$I_{\text{atria}} = h^2$$

### C. Rigid Attachment Envelope
To prevent the major blood vessels (Aorta, Pulmonary Artery, Vena Cava) at the top of the heart from deforming and detaching, a smooth Hermite cubic spline (smoothstep) acts as an envelope to scale down the deformation to zero at $h \ge 0.4$:

$$E(h) = \begin{cases} 
1.0 & \text{if } h \le 0.4 \\
1.0 - t^2(3.0 - 2.0t) & \text{if } h > 0.4 \quad \text{where } t = \frac{h - 0.4}{0.6}
\end{cases}$$

### D. Final Displacement Formula
The final scaling factor $F$ applied to the vertex radial vector $\vec{u} = \vec{p}_{\text{heart}} - \vec{p}_{\text{center}}$ is:

$$F = 1.0 + \left( (S_{\text{ventricle}} - 1.0) \cdot I_{\text{ventricle}} + (S_{\text{atria}} - 1.0) \cdot I_{\text{atria}} + J \right) \cdot E \cdot D_{\text{mesh}}$$

Where $D_{\text{mesh}}$ is a mesh-specific deformation multiplier (e.g. `0.05` for Right Atrium to make it stiffer, `0.15` for Pulmonary Trunk, and `1.0` for ventricles).

The deformed vertex position is reconstructed and transformed back to local space:

$$\vec{p}'_{\text{heart}} = \vec{p}_{\text{center}} + \vec{u} \cdot F$$

$$\vec{p}'_{\text{local}} = \mathbf{M}_{\text{heart\_to\_local}} \cdot \vec{p}'_{\text{heart}}$$

---

## 3. Shader Implementation Detail (GLSL)

The WebGL vertex shader code replaces `#include <begin_vertex>` to perform these calculations on the GPU:

```glsl
#include <begin_vertex>
if (uDeformEnabled > 0.0) {
  // Convert local position to heart space
  vec4 posHeart = uLocalToHeartMatrix * vec4(position, 1.0);
  vec3 uVec = posHeart.xyz - uHeartCenter;
  
  // Calculate normalized height index
  float hRange = uYMax - uYMin;
  float h = hRange > 0.001 ? (posHeart.y - uHeartCenter.y - uYMin) / hRange : 0.5;
  float clampedH = clamp(h, 0.0, 1.0);
  
  // Calculate influence masks
  float ventricleInfluence = (1.0 - clampedH) * (1.0 - clampedH);
  float atriaInfluence = clampedH * clampedH;
  
  // Deviations from resting scale
  float ventricleDev = uVentricleScale - 1.0;
  float atriaDev = uAtriaScale - 1.0;
  float baseScaleDev = ventricleDev * ventricleInfluence + atriaDev * atriaInfluence;
  
  // Smoothstep envelope to fix top vessels
  float envelope = 1.0;
  if (clampedH > 0.4) {
    float t = (clampedH - 0.4) / 0.6;
    envelope = 1.0 - t * t * (3.0 - 2.0 * t);
  }
  
  // Compute final scaling factor
  float factor = 1.0 + (baseScaleDev + uJiggle) * envelope * uDeformEnabled;
  vec3 deformedPosHeart = uHeartCenter + uVec * factor;
  
  // Project deformed coordinates back to local mesh space
  vec4 deformedLocal = uHeartToLocalMatrix * vec4(deformedPosHeart, 1.0);
  transformed = deformedLocal.xyz;
}
```
