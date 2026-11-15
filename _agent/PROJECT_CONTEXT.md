# Project Context: Kefel Lashon (קפל לשון)

This document provides essential context for AI agents working on the **Kefel Lashon** project. It covers the architecture, tech stack, and common development workflows.

## 🚀 Project Overview
**Kefel Lashon** is a web-based platform for managing and displaying a curated collection of educational and linguistic images (puns, wordplay, and visual language exercises). The primary users are Hebrew speakers, teachers, and students.

### Main Goals:
- **Gallery Management**: Admin interface for uploading, tagging, and approving images.
- **Search & Filtering**: Categorized access to images via tags and topics.
- **Interactive Exercises**: Student tasks involving visual wordplay, with teacher-reviewable responses.
- **Optimized Delivery**: Using WebP for performance and Git-based publishing for static site hosting.

---

## 🏗️ Dual-System Architecture
It is critical to understand that the project behaves differently depending on how it is run and where it is hosted.

### 1. Local Management System (Admin)
*   **Purpose**: The "Command Center" for the project. Used to upload, tag, approve, and process images.
*   **Mode Detection**: The React App (`App.jsx`) automatically enters **Admin Mode** if the hostname is `localhost` or `127.0.0.1`.
*   **Features**: Metadata editor, duplicate detection, AI tagging, and the **Publish** button.
*   **Data Source**: Directly reads/writes to `data.json` via the local Express server.

### 2. Public Gallery System (Production)
*   **Purpose**: The viewer-facing site (what students/teachers see).
*   **Mode Detection**: Activated when hosted on GitHub Pages or if `VITE_PUBLIC_VIEWER=true` is set.
*   **Features**: Read-only gallery, search, and filtering. No editor or admin tools.
*   **Data Source**: Fetches from `public-data.json` (a subset of `data.json`).
*   **Image Format**: Typically uses compressed JPGs generated during the public build process for maximum compatibility and speed.

---

## 🏃 Detailed Execution Guide

### Part A: Running the Admin System (For Development/Management)
To run the full admin environment with the metadata editor enabled, you MUST start two separate processes:

1.  **Start the Backend Server (Port 3088)**:
    *   The server handles all file operations (saving metadata, converting images, publishing to Git).
    *   **Command**: 
      ```bash
      cd app
      node server.js
      ```
2.  **Start the Frontend Dev Server (Port 5173)**:
    *   This provides the React UI with Hot Module Replacement (HMR).
    *   **Command**:
      ```bash
      cd app
      npm run dev
      ```
3.  **Action**: Open [http://localhost:5173](http://localhost:5173). You should see the Admin interface with the editor panel on the right.

---

### Part B: Running the Public Gallery (Local Preview)
To simulate the live site experience locally and verify how the public data is generated:

1.  **Prepare the Public Data**:
    *   This script processes all source images, compresses them, and generates the `public-data.json` file.
    *   **Command**:
      ```bash
      cd app
      npm run build:public
      ```
2.  **Run the Preview Server**:
    *   This hosts the production build locally to verify everything is working as intended before deployment.
    *   **Command**:
      ```bash
      cd app
      npm run preview
      ```
3.  **Action**: Open the URL provided by the preview command. You should see the Public Gallery interface (no editor sidebar).

---

## 🛠️ Tech Stack
- **Frontend**: React (Vite, JavaScript). 
  - Styling: Vanilla CSS.
  - Key Components: `PublicGallery.jsx`, `App.jsx`, `DuplicatesReview.jsx`, `SingleViewHeader.jsx`.
- **Backend (Local Admin Only)**: Node.js (Express) in `app/server.js`.
  - Handles image uploads, WebP conversion via `sharp`, and metadata persistence.
- **Database**: 
  - **Flat-file**: `data.json` (Local Source of Truth) and `public-data.json` (Production Data).
  - **Hashes**: `hashes.json` for duplicate detection.
  - **Tags**: `tags_master.json` for normalization.
- **Publishing/Deployment**:
  - The local server has a `/api/publish` endpoint that automates the `git commit` and `git push` flow for images and metadata.

---

## 📁 Directory Structure
- `/app`: Main application directory.
  - `/src`: React source code.
  - `/public/images`: Main storage for optimized `.webp` images.
  - `/server.js`: Local Express server for admin tasks.
- `/תמונות חדשות`: Folder for newly added images waiting for processing/tagging.
- `/scripts`: Utility scripts for bulk tagging, data syncing, and image conversion.
- `data.json`: The "database" containing all image metadata.
- `tags_master.json`: Master mapping for categories and normalized tags.

---

## 🔄 Core Workflows

### 1. Adding & Processing Images
1. Images are dropped into `/תמונות חדשות`.
2. The local server/scripts convert them to `.webp` using `sharp`.
3. Metadata is initialized in `data.json`.
4. The admin uses the UI to add titles, explanations, and tags.

### 2. Tagging & Normalization
- Tags should be comma-separated strings in `data.json`.
- Tagging follows rules defined in `tags_master.json` and `_agent/skills/image-tagging/SKILL.md`.
- AI agents are often asked to "auto-tag" or "refine" tags based on image content or titles.

### 3. Publishing Changes
- Publishing is done via the `api/publish` endpoint.
- It runs `update-public-data.mjs` to prepare the production `public-data.json`.
- It performs `git add`, `git commit`, and `git push` for specific content files.

---

## 📝 Key Conventions & Requirements
- **Language**: The UI and metadata (titles, explanations, tags) are primarily in **Hebrew**.
- **Image Format**: **WebP** is the standard. Avoid using PNG/JPG in the final gallery.
- **Naming**: Sanitize filenames for Windows compatibility (no `<>:"/\|?*`).
- **Safety**: Never stage code files (`.jsx`, `.js`, `.css`) via the automatic `/api/publish` logic.

### Important Files to Watch:
- `data.json`: Current state of all image metadata. **Back it up before large edits.**
- `app/server.js`: Logic for file management, duplicates, and git syncing.
- `app/src/PublicGallery.jsx`: Main UI for the gallery.

---

## 💡 Common Agent Tasks
- Fixing UI bugs (especially mobile layout issues).
- Batch tagging or updating metadata in `data.json`.
- Restoring features overwritten during refactoring.
- Debugging the image upload and conversion pipeline.
