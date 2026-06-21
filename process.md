# SOMA Development Process & AI Guidelines

This document tracks the features implemented in the SOMA Interactive 3D Anatomy Tutor and provides context for AI assistants to ensure stable future development.

## Project Overview
SOMA is a 3D human anatomy tutor. Users can click on anatomical regions on a 3D model, filter them through the explorer, ask the Gemini API questions about them, or use slash commands.

---

## 🛠️ Features Implemented

### 1. Slash Commands & Multi-Highlighting
- **Command Parser:** Intercepts input starting with `/`. If it matches a system name (e.g. `/head`, `/abdomen`), it highlights all regions belonging to that system.
- **Contains/Side Matcher:** If keywords are typed (e.g. `/Epigastric Region`), it highlights all matching regions. If the user doesn't specify left/right, it automatically matches and highlights both sides.
- **Turntable Orbit Zoom:** The camera frames the highlighted group using a combined bounding box. The horizontal center is locked to the rotation axis (`x=0, z=0`) so turntable rotation remains perfectly stable and center-focused.

### 2. Selection Sync
- **Interactive Sync:** Selecting an organ on the 3D model or in the sidebar populates the chat input with its slash command (e.g. `/{RegionName}`). Selecting a system tab filters the explorer and fills the chat input with `/{SystemName}`.

### 3. Layout Locking
- **Zero Shift UI:** Locked the desktop Chat box (`420px`) and SOMA Explorer sidebar (`280px`) dimensions to prevent panel squishing and browser reflow shifting when toggling.

---

## ⚠️ AI Guidelines & Committing Rules

To maintain codebase integrity, any AI assistant working on this project **must follow these rules**:

1. **Do Not Commit AI Artifacts:** 
   - Never commit local development artifacts (e.g. `task.md`, `implementation_plan.md`, `walkthrough.md`) or temporary scratch scripts (`scratch/*`) created in the `.gemini/` app data directory. 
   - Keep these configuration paths out of the Git tree.
2. **Atomic State Updates:**
   - Always group sequential message updates into a single state change (e.g. `setMessages([...newMessages, reply])`). Do not batch sequential `setMessages` updates asynchronously, as it leads to React race conditions.
3. **Turntable Target Lock:**
   - When zooming the camera on multiple organs, always lock the target `x` and `z` coordinates to the model Y-axis (`0, center.y, 0`) to keep the rotation smooth and center-focused.
4. **Compile Check:**
   - Always verify that the project compiles cleanly using `npm run build` before pushing any commits.
