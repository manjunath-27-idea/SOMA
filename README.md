# SOMA

### *The Real-Time AI-Driven Anatomical Digital Twin*

> **"Bridging Medical Precision with Artificial Intelligence."**

SOMA (Greek for "Body") is an interactive, web-based medical education platform that bridges the gap between complex anatomical data and natural language learning. It features a high-fidelity, 228-mesh 3D human model integrated with a "Spatial AI" brain.

Unlike static 3D models or text-based medical bots, SOMA synchronizes human-like conversation with real-time 3D manipulation. When the AI explains a biological process, the model reacts—zooming into specific organs, peeling back layers of tissue, and highlighting structures precisely at the moment they are mentioned.

---

## 🌟 Core Features

* **AI-Spatial Synchronization:** Powered by the Google Gemini API (with GPT-4o compatibility), the AI doesn't just talk; it acts. It identifies anatomical coordinates to trigger automated camera zooms and focal highlights.
* **Complete Biological Atlas:** A structured 3D hierarchy representing the skeletal, muscular, circulatory, and organ systems.
* **Dynamic X-Ray Vision:** Real-time material manipulation allows the AI to make skin or muscles transparent to reveal deep-seated internal organs during explanations.
* **Contextual Animation:** Conceptual animations (such as heart rhythms or respiratory cycles) trigger dynamically based on the chat context.
* **Zero-Footprint Web Engine:** Built on Three.js/React Three Fiber, the platform delivers high-precision medical visualization directly in the browser without requiring heavy software installations.
* **Slash Commands (`/`):** Directly query systems or groups of regions from the chat box (e.g. `/head`, `/abdomen`, or `/Epigastric Region`) to automatically trigger zoom framing, multi-organ highlights, and auto-rotation.
* **Selection-to-Input Sync:** Clicking any organ or system tab automatically populates the chat box with its corresponding slash command format.

---

## 🛠️ Technical Architecture

* **The Body (Frontend):** React Three Fiber (R3F) and Three.js for hardware-accelerated 3D rendering.
* **The Brain (AI):** Google Gemini API / OpenAI API with a custom system prompt for "Anatomical Mapping."
* **The Interface:** A responsive side-by-side UI where the 3D viewport and AI terminal share a real-time state.
* **The Precision Logic:** A custom Regex-based command parser that translates AI text streams and user slash inputs into 3D scene actions (e.g., camera framing and solid highlighting).

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

---

## 🎯 Mission Statement

The goal of Project SOMA is to democratize medical knowledge. By turning a complex 3D human atlas into a conversational partner, we make the study of human biology intuitive, accessible, and interactive for students, medical professionals, and curious minds alike.
