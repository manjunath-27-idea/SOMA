# SOMA - Interactive 3D Human Anatomy Tutor

SOMA is a modern, responsive 3D web application designed for learning human anatomy interactively. Built with **React**, **Three.js (React Three Fiber)**, and powered by the **Google Gemini API** (with local offline fallback), SOMA offers a premium learning experience.

---

## 🚀 Key Features

* **Interactive 3D Human Mesh:** Select regions directly on the 3D model. Hovering highlights regions in soft grey-blue, and clicking focuses them in corporate blue.
* **Dual Modes (Online & Offline):**
  * **Online (Gemini API):** Set your Gemini API key in the SOMA Explorer settings to enable general biological reasoning, detailed explanations, and contextual anatomical conversation.
  * **Offline (Local Dictionary):** Search a local database of 256 anatomical regions with descriptions, functions, and clinical significance when no API key is set.
* **Slash Commands (`/`):** Directly query systems or groups of regions from the chat box (e.g. `/head`, `/abdomen`, or `/Epigastric Region`).
* **Multi-Organ Highlighting:** Highlight multiple organs at the same time.
* **Stable Turntable Auto-Rotation:** When systems or groups are selected, the camera frames them cleanly while keeping the model smoothly rotating so you can inspect them from the front, side, and back.
* **Layout Isolation:** Panels are locked to avoid layout shifting or panel squishing during sidebar toggle transitions.
* **Selection-to-Input Sync:** Clicking any organ or system tab automatically populates the chat box with its corresponding slash command format.

---

## 🛠️ Tech Stack

* **Frontend:** React (Vite)
* **3D Graphics:** Three.js, React Three Fiber (R3F), `@react-three/drei`
* **Icons:** Lucide React
* **Styling:** CSS (Flexbox grid, responsive layouts)

---

## 📦 Installation & Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Run in Development Mode:**
   ```bash
   npm run dev
   ```
3. **Build for Production:**
   ```bash
   npm run build
   ```

---

## 🔍 Slash Command Examples

* `/Head` — Highlights all head organs and zooms to the head.
* `/Neck` — Highlights all neck organs and zooms to the neck.
* `/Epigastric Region` — Highlights both the Left and Right Epigastric regions simultaneously (automatic side matching).
* `/Left Epigastric Region, Left Umbilical Region` — Highlights multiple specific regions.
