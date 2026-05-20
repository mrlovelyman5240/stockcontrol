# Stockcontrol — Project Instructions

Full-stack inventory management web application.

## Repository Structure
- `/frontend` → React app (`src/pages`, `src/components`)
- `/backend` → Python FastAPI/Flask server (`server.py`)

## Tech Stack
- Frontend: React, JavaScript
- Backend: Python
- Database: check `backend/server.py` for current DB setup

## GitHub Workflow
- Always work on existing files, never create duplicate structures
- Before starting any task: `git pull`
- After every change: `git add . && git commit -m "[description]" && git push`

## Rules
- Never break existing functionality when adding features
- Always test that the app still runs after changes
- Keep Turkish UI text as-is, only modify what is asked
- When adding new features, follow existing code patterns

## Current Goals
1. Make the app mobile-friendly (PWA)
2. Set up deployment (Vercel for frontend, Railway for backend)
3. Improve features as requested

## On Every Change Request
1. Read the relevant file first
2. Make the minimal change needed
3. Commit and push to GitHub automatically
