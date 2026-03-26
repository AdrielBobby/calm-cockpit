import sqlite3
import click
from flask import current_app, g

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(
            current_app.config['DATABASE'],
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    db = get_db()
    
    schema = """
    -- Finance
    CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT,
        note TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts (id)
    );

    -- Attendance
    CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS timetable (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_of_week TEXT NOT NULL,
        subject_id INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        FOREIGN KEY (subject_id) REFERENCES subjects (id)
    );
    CREATE TABLE IF NOT EXISTS holidays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        reason TEXT
    );
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        timetable_id INTEGER NOT NULL,
        status TEXT NOT NULL, -- 'attended', 'missed'
        FOREIGN KEY (timetable_id) REFERENCES timetable (id),
        UNIQUE(date, timetable_id)
    );

    CREATE TABLE IF NOT EXISTS timetable_variations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timetable_id INTEGER, -- Nullable for new ad-hoc slots
        date TEXT NOT NULL,
        subject_id INTEGER, -- Nullable if action is delete
        start_time TEXT,
        end_time TEXT,
        action TEXT NOT NULL, -- 'modify', 'delete', 'add'
        FOREIGN KEY (timetable_id) REFERENCES timetable (id),
        FOREIGN KEY (subject_id) REFERENCES subjects (id)
    );

    -- Weekly Goals
    CREATE TABLE IF NOT EXISTS weekly_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_start_date TEXT NOT NULL,
        text TEXT NOT NULL,
        notes TEXT,
        is_completed BOOLEAN NOT NULL DEFAULT 0,
        carried_from_goal_id INTEGER
    );

    -- Gym
    CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workout_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL,
        exercise_id INTEGER NOT NULL,
        sets INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        weight REAL,
        FOREIGN KEY (workout_id) REFERENCES workouts (id),
        FOREIGN KEY (exercise_id) REFERENCES exercises (id)
    );

    -- Projects
    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT NOT NULL, -- 'planned', 'in_progress', 'paused', 'done'
        priority TEXT,
        started_date TEXT,
        target_date TEXT,
        last_updated TEXT
    );
    CREATE TABLE IF NOT EXISTS project_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        note TEXT NOT NULL,
        state TEXT,
        FOREIGN KEY (project_id) REFERENCES projects (id)
    );

    -- Grades
    CREATE TABLE IF NOT EXISTS semesters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number INTEGER NOT NULL UNIQUE,
        sgpa REAL
    );
    CREATE TABLE IF NOT EXISTS internal_marks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        semester_id INTEGER NOT NULL,
        subject_index INTEGER NOT NULL, -- 0-5 for the 6 columns
        internal_number INTEGER NOT NULL, -- 1 or 2
        mark REAL,
        FOREIGN KEY (semester_id) REFERENCES semesters (id),
        UNIQUE(semester_id, subject_index, internal_number)
    );

    -- Calendar Events
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        label TEXT DEFAULT 'Personal',
        status TEXT DEFAULT 'planned'
    );
    """
    db.executescript(schema)
    db.commit()

@click.command('init-db')
def init_db_command():
    """Clear the existing data and create new tables."""
    init_db()
    click.echo('Initialized the database.')

def init_app(app):
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
