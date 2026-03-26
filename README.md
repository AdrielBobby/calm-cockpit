Calm Cockpit
Calm Cockpit is a personal “mission control” dashboard for students. It’s a single‑page Flask app with a premium dark UI that brings together attendance, timetable, grades, projects, finance, goals, and gym tracking into one place.

Built with a framework‑lite approach: Flask, Jinja, SQLite, and vanilla JS/CSS.

Features
Overview dashboard

Today’s timetable and quick attendance snapshot

Monthly calendar with upcoming events

Weekly goals and progress

Attendance & timetable

Per‑subject attendance tracking

Date‑range “window” view for internal exam eligibility

Grades & exams

Semester SGPA history

ESE grade calculator for each subject

Projects log

Simple Kanban‑style states (planned / in‑progress / paused / done)

Last‑updated notes per project

Finance

Lightweight personal finance tracker (cash, bank, metro)

Net balance summary

Gym tracker

Workout log and basic charts

Other goodies

Collapsible left sidebar navigation

Keyboard shortcuts to jump between sections

Dark, responsive layout that works on desktop and mobile

Tech Stack
Backend: Flask (Python 3), Click for CLI commands

Frontend: Jinja templates, vanilla JS (modules per feature), CSS Grid/Flexbox

Database: SQLite (via Python’s sqlite3)

Deployment target: PythonAnywhere (free tier) with persistent SQLite

Getting Started
bash
# clone
git clone https://github.com/<your-username>/calm-cockpit.git
cd calm-cockpit

# create & activate virtualenv (example using venv)
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# install dependencies
pip install -r requirements.txt

# initialize database
flask init-db

# run dev server
python run.py
Then open http://127.0.0.1:5000 in your browser.

Deploying to PythonAnywhere
There is a detailed deployment guide in deployment_guide.md that covers:

Creating a virtualenv on PythonAnywhere

Configuring the WSGI file to use run.py

Initializing the SQLite database with flask init-db

Reloading the web app after pulling new changes
​

Project Status
This repo currently contains the single‑page version of Calm Cockpit.
Future plans:

Split views (separate pages) for Grades, Finance, and Gym

Better mobile layout for heavy tables and charts

Optional login / multi‑user support
