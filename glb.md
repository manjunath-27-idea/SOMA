# SOMA 3D Anatomy Model: Nervous System & Sense Organs GLB Structure

This document describes the structure of SOMA's anatomical 3D asset (`Nervous_system.glb`), the optimization steps undertaken, and how to maintain the asset configuration.

---

## 1. Material and Color Architecture

To prevent WebGL rendering lag and ensure cross-platform compatibility, the model's material system uses a **Viewport-Isolated Direct Principled BSDF System**.

### Viewport Color Split (Solid Grey vs. Shaded Color)
To preserve the 3D artist's clean editing workspace in Blender while maintaining colorful renders in SOMA:
*   **Blender Solid Shading Viewport:** All anatomical materials are assigned a neutral viewport color of **solid grey (`[0.8, 0.8, 0.8, 1.0]`)**.
*   **Blender Material Viewport & Exported GLB:** The shader node tree connects a direct **Principled BSDF** node with the correct **biological color**. The glTF exporter reads this node to color SOMA.

### 26 Anatomical Materials & Hex Map
Below is the definitive list of the simplified anatomical materials exported to the GLB:

| Material Name | Hex Color | Color Representation | Anatomical Target |
| :--- | :--- | :--- | :--- |
| **`Iris`** | `#522e14` | Rich dark brown | Iris of eyeball |
| **`Cornea`** | `#735940` (Opacity: 0.3) | Translucent warm brown | Lens & outer cornea dome |
| **`Eye`** | `#f2f2f2` | Off-white | Sclera (White of eye) |
| **`Ligament`** | `#ccfff7` | Pale mint green | Suspensory ligaments |
| **`Orbicularis/Constrictor`** | `#cc2718` | Pink-red | Ciliary body & zonular fibres |
| **`Olfactory`** | `#f2e8d9` | Myelinated cream | Olfactory nerve (I) |
| **`Nerve`** | `#ffff00` | Pure bright yellow | General cranial nerves |
| **`YellowNerves`** | `#ffff00` | Pure bright yellow | Spinal roots, Cauda equina |
| **`Ear_Material`** | `#cc8c59` | Bony Tan | Cochlea & vestibular system |
| **`Bone-1`** | `#e5e0d1` | Pale bone white | Vestibule bones |
| **`SpinalCord_Material`** | `#f2e5d8` | White matter cream | Spinal tracts |
| **`Spinal_Cord_Grey_Matter`** | `#bf998c` | Pinkish-grey | Spinal horns/grey matter |
| **`White matter`** | `#f2eae0` | Brain white matter cream | Internal brain tracts |
| **`Cerebellum`** | `#8c4c8c` | Purple | Cerebellar cortex |
| **`Brain`** | `#e5cca5` | Tan | Brainstem, Pons, Medulla |
| **`Brain-Inner`** | `#f2d8bf` | Beige | Deep cerebral structures |
| **`Artery`** | `#c62828` | Deep red | Choroid plexus |
| **`Cartilage`** | `#b2d8e5` | Light blue-grey | Falx cerebri, dura reflections |
| **`Fascia`** | `#7ab7cc` | Greyish-blue | Spinal dura mater sheath |
| **`Gland`** | `#cc4221` | Orange-red | Lacrimal glands |
| **`LCR`** | `#70ccbc` | CSF Teal | Ventricles (Cerebrospinal fluid) |
| **`Mucosa`** | `#a3303f` | Dark pink | Lacrimal canaliculi & sacs |
| **`Nucleus`** | `#7f280a` | Reddish-brown | Deep brain nuclei |
| **`Nucleus (afferent fibers)`** | `#284f75` | Dark blue | Sensory tract nuclei |
| **`Nucleus (efferent fibers)`** | `#871411` | Dark red | Motor tract nuclei |
| **`Tympanic_Membrane`** | `#d8d8e0` | Pearly grey | Eardrum |

---

## 2. Anatomical Grouping & Overrides

### Eyeball Blocker Overrides (`src/Model.jsx`)
Eyeballs contain fluid-filled chambers (`Anterior segment`, `Anterior chamber`, `Vitreous body`) which are modeled as solid geometries. When exported, these geometries block the internal structures (iris and lens), making the eyeball look like a solid white shell.

To resolve this, SOMA’s React loader (`src/Model.jsx`) overrides these meshes dynamically:
1.  **Visibility & Opacity Zeroed:** Helper volume segments are set to `clonedMat.visible = false` and `opacity = 0.0`.
2.  **Cornea Transparency:** The outer cornea lens dome material transparency is enabled (`clonedMat.transparent = true`) and set to `clonedMat.opacity = 0.3` to show the brown iris inside.

### Cerebral Cortex Grouping
To optimize draw calls in WebGL, the **120+ sub-gyri and sub-sulci** of the cerebral cortex share **6 lobe materials** rather than having individual materials:
*   `Frontal lobe` (Red - `#d86666`)
*   `Parietal lobe` (Blue - `#667fd8`)
*   `Temporal lobe` (Green - `#66bf7f`)
*   `Occipital lobe` (Orange - `#d8994c`)
*   `Limbic lobe` (Teal - `#4cb2b2`)
*   `Insula` (Magenta - `#bf66a5`)

---

## 3. Modification History

*   **Step 1: eyeball Blocker Bypass:** Configured React overrides in `Model.jsx` to hide auxiliary eyeball segments, resolving the solid white blocker bug.
*   **Step 2: Material Node Tree Simplification:** Converted all custom node groups to direct **Principled BSDF** shader links. This resolved a glTF exporter bug where complex node groups defaulted to solid grey.
*   **Step 3: Viewport View Isolation:** Set all anatomical `diffuse_color` viewport values to neutral grey `[0.8, 0.8, 0.8, 1.0]` in Blender while keeping colors active in shader nodes, protecting the editor viewport layout.
*   **Step 4: Olfactory & Spinal Root Colorizations:** Assigned olfactory nerves to myelinated cream and mapped the anterior roots, posterior roots, and Cauda equina to bright yellow `YellowNerves`.
*   **Step 5: Medulla Grey Matter Clean-up:** Corrected a naming collision where `Grey matter of medulla oblongata.` (with a trailing period) bypassed the helper deletion script. Renamed both object and mesh data blocks cleanly to `Grey matter of medulla oblongata`.

---

## 4. Headless Compilation & Export Pipeline

To generate the final model automatically, the python compilation script `apply_nerve_materials_and_export.py` runs headlessly in Blender:

1.  **Loads original editor file:** Opens `Nervous_system_and_Sense_organs2.blend`.
2.  **Performs Renamings:** Renames medulla oblongata grey matter to remove suffixes.
3.  **Remaps Nerve Materials:** Scans and connects all spinal roots and Cauda equina to `YellowNerves`.
4.  **Enforces Material Shaders:** Loops through all 26 materials, sets viewport display to grey, connects a clean Principled BSDF node to the material output, and sets the base color.
5.  **Performs Clean-up:** Unparents all objects keeping world transforms intact, and deletes all helper curves/joints (ending in `.g`, `.j`, `.t`).
6.  **Exports clean asset:** Saves the output directly to SOMA's production assets: `soma/public/Nervous_system.glb`.
