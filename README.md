# SOMA

### *The Real-Time AI-Driven Anatomical Digital Twin*

> **"Bridging Medical Precision with Artificial Intelligence."**

SOMA (Greek for "Body") is an interactive, web-based medical education platform that bridges the gap between complex anatomical data and natural language learning. It features a high-fidelity, 228-mesh 3D human model integrated with a "Spatial AI" brain.

Unlike static 3D models or text-based medical bots, SOMA synchronizes human-like conversation with real-time 3D manipulation. When the AI explains a biological process, the model reacts—zooming into specific organs, peeling back layers of tissue, and highlighting structures precisely at the moment they are mentioned.

---

## 🌟 Core Features

* **AI-Spatial Synchronization:** Integrated with the Google Gemini API (with OpenAI/GPT-4o fallback). SOMA parses the AI's natural language responses in real-time, extracting anatomical coordinates to trigger smooth camera zooms, focus targets, and highlighted glows.
* **Multi-System Biological Atlas:** Structured 3D hierarchies representing:
  * **Skeletal System** (`Skeleton.glb`)
  * **Muscular/Cardiovascular System** (`Cardio.glb`)
  * **High-Definition Heart** (`Heart.glb`)
  * **Nervous System & Sense Organs** (`Nervous_system.glb`)
* **Dynamic X-Ray & Peel-Back Vision:** Dynamic material manipulation allows the rendering engine to hide or make muscle/bone layers transparent, exposing deep internal organs when referenced by the AI.
* **GPU-Accelerated Heartbeat Animation:** Conceptual cardiac cycles (atrial contraction, ventricular contraction, and valve closure rebounds) are animated in real-time directly on the GPU using custom vertex shaders.
* **Selection-to-Input Sync:** Clicking any organ in the 3D viewport or browsing the anatomical hierarchy sidebar automatically focuses the region, highlights it, and populates the chat box with its corresponding slash command.
* **Contextual Command Palette:** Support for slash commands (e.g., `/head`, `/abdomen`, `/Epigastric Region`) to trigger automated zooming, side-matching, and orbital rotations.

---

## 🛠️ Technical Architecture

* **3D Render Engine:** Built on **React Three Fiber (R3F)** and **Three.js** for hardware-accelerated 3D graphics directly in the browser.
* **AI Cognitive Layer:** Contextual medical prompting using custom system prompts and real-time streaming parser.
* **Custom GLSL Shader Pipeline:** To achieve smooth, lag-free deformations like the heartbeat, SOMA overrides default Three.js materials via `onBeforeCompile`, deforming vertices in local heart-space with custom uniform parameters.
* **Material Shading Isolation:** To protect the 3D artist's workstation, SOMA implements a viewport color split:
  * **Blender viewport:** Solid grey (`[0.8, 0.8, 0.8]`) for clutter-free editing.
  * **GLB/SOMA Shader:** Full biological colors exported via Principled BSDF nodes.
* **Automated Asset Pipeline:** Uses headless Python scripting (`apply_nerve_materials_and_export.py`) to automate mesh cleaning, material mapping, unparenting, and glTF/GLB export.

---

## 📦 Installation & Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Configure API Keys:**
   Create a `.env` file in the root directory:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. **Run in Development Mode:**
   ```bash
   npm run dev
   ```
4. **Build for Production:**
   ```bash
   npm run build
   ```

---

## 🔍 Slash Command Examples

* `/Head` — Automatically focuses and frames the cranial region.
* `/Neck` — Zooms into the cervical vertebrae and neck musculature.
* `/Epigastric Region` — Focuses and highlights abdominal regions.
* `/Left Epigastric Region, Left Umbilical Region` — Highlights multiple specific structures simultaneously.

---

## 🎯 Mission Statement

The goal of Project SOMA is to democratize medical knowledge. By turning a complex 3D human atlas into a conversational partner, we make the study of human biology intuitive, accessible, and interactive for students, medical professionals, and curious minds alike.
