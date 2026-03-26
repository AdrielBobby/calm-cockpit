import sqlite3
db = sqlite3.connect(r'instance\cockpit.db')
try:
    db.execute('ALTER TABLE events ADD COLUMN status TEXT DEFAULT "planned"')
    db.commit()
    print('status column added successfully.')
except sqlite3.OperationalError as e:
    print('Migration skipped or failed:', e)
db.close()
