from flask import Blueprint, jsonify, request
from app.db import get_db
from datetime import datetime, timedelta
from marshmallow import Schema, fields, validate, RAISE

bp = Blueprint('attendance', __name__, url_prefix='/api/attendance')

class MarkAttendanceSchema(Schema):
    class Meta:
        unknown = RAISE
    date = fields.String(required=True, validate=validate.Length(max=50))
    timetable_id = fields.Integer(required=True, strict=True)
    status = fields.String(required=True, validate=validate.OneOf(['attended', 'missed']))

class DateOnlySchema(Schema):
    class Meta:
        unknown = RAISE
    date = fields.String(required=True, validate=validate.Length(max=50))

class AddTimetableSchema(Schema):
    class Meta:
        unknown = RAISE
    day = fields.String(required=True, validate=validate.Length(max=50))
    start = fields.String(required=True, validate=validate.Length(max=50))
    end = fields.String(required=True, validate=validate.Length(max=50))
    subject_id = fields.Integer(allow_none=True)
    subject_name = fields.String(allow_none=True, validate=validate.Length(max=255))

class UpdateTimetableSchema(Schema):
    class Meta:
        unknown = RAISE
    start = fields.String(allow_none=True, validate=validate.Length(max=50))
    end = fields.String(allow_none=True, validate=validate.Length(max=50))
    subject_name = fields.String(allow_none=True, validate=validate.Length(max=255))

class AddSubjectSchema(Schema):
    class Meta:
        unknown = RAISE
    name = fields.String(required=True, validate=validate.Length(min=1, max=255))

@bp.route('/data', methods=['GET'])
def get_attendance_data():
    db = get_db()
    seed_timetable(db)
    
    # helper for dates
    today = datetime.now().date()
    start_of_week = today - timedelta(days=today.weekday()) # Monday
    end_of_week = start_of_week + timedelta(days=6) # Sunday
    
    # 1. Get Subjects
    subjects = db.execute('SELECT id, name FROM subjects').fetchall()
    subjects_dict = {s['id']: {'name': s['name'], 'attended': 0, 'total': 0} for s in subjects}
    
    # 2. Get Global Attendance Stats (All time)
    # We rely on 'attendance' table being the source of truth for past classes.
    # Exclude holidays from stats if they ended up in attendance table (or if we count them hereafter)
    
    records = db.execute('''
        SELECT a.timetable_id, a.status, a.date 
        FROM attendance a
        LEFT JOIN holidays h ON a.date = h.date
        WHERE h.date IS NULL
    ''').fetchall()
    
    # We also need to know which subject each timetable_id belongs to
    timetable_map = db.execute('SELECT id, subject_id FROM timetable').fetchall()
    tm_subject_map = {t['id']: t['subject_id'] for t in timetable_map}
    
    for r in records:
        sid = tm_subject_map.get(r['timetable_id'])
        if sid and sid in subjects_dict:
            # Only count if not holiday (handled by SQL JOIN above)
            # And standard logic: attended/missed count towards total. 
            if r['status'] in ['attended', 'missed']:
                 subjects_dict[sid]['total'] += 1
            
            if r['status'] == 'attended':
                subjects_dict[sid]['attended'] += 1

    # Format subjects for response
    subjects_res = []
    for sid, data in subjects_dict.items():
        pct = (data['attended'] / data['total'] * 100) if data['total'] > 0 else 0
        subjects_res.append({
            'id': sid,
            'name': data['name'],
            'attended': data['attended'],
            'total': data['total'],
            'percentage': round(pct, 1)
        })

    # 3. Weekly Status (Missed, Remaining)
    # Get all timetable slots
    all_slots = db.execute('SELECT t.id, t.day_of_week, t.start_time, t.end_time, s.name as subject_name FROM timetable t JOIN subjects s ON t.subject_id = s.id').fetchall()
    
    # Map day name to date for this week
    # Python weekday(): Mon=0, Sun=6.
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    
    missed_count = 0
    remaining_count = 0
    
    # Get holidays for this week
    holidays = db.execute('SELECT date FROM holidays WHERE date BETWEEN ? AND ?', 
                          (start_of_week.isoformat(), end_of_week.isoformat())).fetchall()
    holiday_dates = {h['date'] for h in holidays}

    today_idx = today.weekday() # 0-6
    
    # Weekly slots visualization
    weekly_slots = []

    for i, day_name in enumerate(days):
        current_date_obj = start_of_week + timedelta(days=i)
        current_date_str = current_date_obj.isoformat()
        
        is_holiday = current_date_str in holiday_dates
        is_past = i < today_idx
        is_today = i == today_idx
        
        day_slots = [s for s in all_slots if s['day_of_week'] == day_name]
        
        for slot in day_slots:
            slot_status = 'pending'
            
            # Check if marked
            attendance_rec = db.execute('SELECT status FROM attendance WHERE date = ? AND timetable_id = ?', 
                                        (current_date_str, slot['id'])).fetchone()
            
            if attendance_rec:
                slot_status = attendance_rec['status'] # attended / missed
                if slot_status == 'missed' and current_date_str >= start_of_week.isoformat():
                     # Only count missed this week for the specific "Missed this week" counter? 
                     # Actually simple counter is fine.
                     pass
            elif is_holiday:
                slot_status = 'holiday'
            elif is_past:
                slot_status = 'unmarked' # Should prompt user?
            
            # Counters
            # For weekly context: exclude holidays from "missed/remaining" logic?
            # User: "if a slot’s date is in holidays... exclude it from the total count in subject statistics and from weekly missed/remaining."
            
            if current_date_str >= start_of_week.isoformat() and current_date_str <= end_of_week.isoformat():
                 if not is_holiday:
                     if slot_status == 'missed':
                         missed_count += 1
                     elif slot_status == 'pending':
                         remaining_count += 1
            
            weekly_slots.append({
                'id': slot['id'],
                'day': day_name,
                'date': current_date_str,
                'subject': slot['subject_name'],
                'start': slot['start_time'],
                'end': slot['end_time'],
                'status': slot_status
            })

    # 4. Apply Variations (Temporary Edits)
    # Get start/end of week dates again to be sure
    s_date = start_of_week.isoformat()
    e_date = end_of_week.isoformat()
    
    variations = db.execute('''
        SELECT * FROM timetable_variations 
        WHERE date BETWEEN ? AND ?
    ''', (s_date, e_date)).fetchall()
    
    # Create a map for quick lookup: date -> list of variations
    # Actually, simpler: just iterate and apply.
    # Note: Variations can be 'modify' (linked to timetable_id), 'delete' (linked to timetable_id), or 'add' (no timetable_id)
    
    # Filter out deleted slots
    # We need to process the list of `weekly_slots` and apply changes.
    
    final_weekly_slots = []
    
    # Helper to find variation for a slot
    def get_variation(slot_id, slot_date):
        for v in variations:
            if v['timetable_id'] == slot_id and v['date'] == slot_date:
                return v
        return None

    # First pass: Process existing slots (modify or delete)
    for slot in weekly_slots:
        var = get_variation(slot['id'], slot['date'])
        
        if var:
            if var['action'] == 'delete':
                continue # Skip adding this slot
            elif var['action'] == 'modify':
                # Apply changes
                # Need subject name
                if var['subject_id']:
                    sub_name = db.execute('SELECT name FROM subjects WHERE id = ?', (var['subject_id'],)).fetchone()['name']
                    slot['subject'] = sub_name
                if var['start_time']:
                    slot['start'] = var['start_time']
                if var['end_time']:
                    slot['end'] = var['end_time']
                final_weekly_slots.append(slot)
        else:
            final_weekly_slots.append(slot)

    # Second pass: Process 'add' variations (new slots)
    # TODO: 'add' logic not fully requested yet, but good to have placeholder if needed.
    # For now, just modification/deletion of existing is the priority.
    
    return jsonify({
        'subjects': subjects_res,
        'weekly_context': {
            'missed': missed_count,
            'remaining': remaining_count,
            'slots': final_weekly_slots
        }
    })

def seed_timetable(db):
    # Check if timetable has data
    count = db.execute('SELECT COUNT(*) as c FROM timetable').fetchone()['c']
    if count > 0:
        return

    # Seed Subjects
    subjects_list = ['OS', 'MSE', 'PDNA', 'TOC', 'COI', 'CAD', 'Python', 'OS Lab', 'Python Lab']
    sub_map = {}
    for name in subjects_list:
        # Check if exists (safe fallback)
        cur = db.execute('SELECT id FROM subjects WHERE name = ?', (name,))
        row = cur.fetchone()
        if row:
            sub_map[name] = row['id']
        else:
            cur = db.execute('INSERT INTO subjects (name) VALUES (?)', (name,))
            sub_map[name] = cur.lastrowid

    # Seed Timetable
    # Format: day, start, end, subject
    schedule = [
        ('Monday', '08:30', '09:35', 'OS'),
        ('Monday', '09:35', '10:40', 'MSE'),
        ('Monday', '11:00', '12:00', 'PDNA'),
        ('Monday', '13:00', '14:00', 'TOC'),
        ('Monday', '14:00', '15:00', 'COI'),
        ('Monday', '15:15', '16:15', 'TOC'),

        ('Tuesday', '08:30', '09:35', 'TOC'),
        ('Tuesday', '09:35', '10:40', 'CAD'),
        ('Tuesday', '11:00', '12:00', 'Python'),
        ('Tuesday', '13:00', '14:00', 'OS Lab'),
        ('Tuesday', '14:00', '15:00', 'OS Lab'),
        ('Tuesday', '15:15', '16:15', 'OS Lab'),

        ('Wednesday', '08:30', '09:35', 'COI'),
        ('Wednesday', '09:35', '10:40', 'PDNA'),
        ('Wednesday', '11:00', '12:00', 'OS'),
        ('Wednesday', '13:00', '14:00', 'MSE'),
        ('Wednesday', '14:00', '15:00', 'CAD'),
        ('Wednesday', '15:15', '16:15', 'Python'),

        ('Thursday', '08:30', '09:35', 'Python'),
        ('Thursday', '09:35', '10:40', 'CAD'),
        ('Thursday', '11:00', '12:00', 'OS'),
        ('Thursday', '13:00', '14:00', 'Python Lab'),
        ('Thursday', '14:00', '15:00', 'Python Lab'),
        ('Thursday', '15:15', '16:15', 'Python Lab'),

        ('Friday', '08:30', '09:30', 'PDNA'),
        ('Friday', '09:30', '10:30', 'Python'),
        ('Friday', '10:40', '11:35', 'PDNA'),
        ('Friday', '14:00', '14:50', 'OS'),
        ('Friday', '14:50', '15:40', 'MSE'),
        ('Friday', '15:40', '16:30', 'TOC'),
    ]

    for day, start, end, sub in schedule:
        if sub in sub_map:
            db.execute('INSERT INTO timetable (day_of_week, subject_id, start_time, end_time) VALUES (?, ?, ?, ?)',
                       (day, sub_map[sub], start, end))
    
    db.commit()

@bp.route('/mark', methods=['POST'])
def mark_attendance():
    data = MarkAttendanceSchema().load(request.get_json() or {})
    db = get_db()
    
    # Upsert logic (mark or change status)
    db.execute('''
        INSERT INTO attendance (date, timetable_id, status)
        VALUES (?, ?, ?)
        ON CONFLICT(date, timetable_id) DO UPDATE SET status=excluded.status
    ''', (data['date'], data['timetable_id'], data['status']))
    
    db.commit()
    db.commit()
    return jsonify({'status': 'success'})

@bp.route('/holiday', methods=['POST'])
def mark_holiday():
    data = DateOnlySchema().load(request.get_json() or {})
    db = get_db()
    try:
        db.execute('INSERT INTO holidays (date) VALUES (?)', (data['date'],))
        db.commit()
    except:
        # Ignore duplicate
        pass
    return jsonify({'status': 'success'})

@bp.route('/holiday', methods=['DELETE'])
def remove_holiday():
    data = DateOnlySchema().load(request.get_json() or {})
    db = get_db()
    db.execute('DELETE FROM holidays WHERE date = ?', (data['date'],))
    db.commit()
    return jsonify({'status': 'success'})

@bp.route('/timetable', methods=['POST'])
def add_timetable_entry():
    data = AddTimetableSchema().load(request.get_json() or {})
    db = get_db()
    
    # Check if subject_id is passed OR name
    subject_id = data.get('subject_id')
    subject_name = data.get('subject_name')
    
    if not subject_id and subject_name:
        # Check if exists
        existing = db.execute('SELECT id FROM subjects WHERE name = ?', (subject_name,)).fetchone()
        if existing:
            subject_id = existing['id']
        else:
            cur = db.execute('INSERT INTO subjects (name) VALUES (?)', (subject_name,))
            subject_id = cur.lastrowid
            
    if not subject_id:
        return jsonify({'status': 'error', 'message': 'Subject required'}), 400

    db.execute('INSERT INTO timetable (day_of_week, subject_id, start_time, end_time) VALUES (?, ?, ?, ?)',
               (data['day'], subject_id, data['start'], data['end']))
    db.commit()
    return jsonify({'status': 'success'})

@bp.route('/reset', methods=['DELETE'])
def reset_data():
    db = get_db()
    db.execute('DELETE FROM attendance')
    db.execute('DELETE FROM timetable_variations')
    db.execute('DELETE FROM holidays')
    db.execute('DELETE FROM timetable')
    # Optional: Delete subjects too? User said "clear the attendance and... adding subjects and clearing it"
    # Safest is to clear everything to "start fresh"
    db.execute('DELETE FROM subjects') 
    db.commit()
    return jsonify({'status': 'success'})

@bp.route('/window', methods=['GET'])
def get_attendance_window():
    db = get_db()
    start_str = request.args.get('start', '').strip()
    end_str = request.args.get('end', '').strip()

    # Validate params
    if not start_str or not end_str:
        return jsonify({'error': 'Both start and end dates are required.'}), 400

    try:
        start_date = datetime.strptime(start_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD.'}), 400

    if start_date > end_date:
        return jsonify({'error': 'Start date must be before or equal to end date.'}), 400

    # Get subjects
    subjects = db.execute('SELECT id, name FROM subjects').fetchall()
    subjects_dict = {s['id']: {'name': s['name'], 'attended': 0, 'total': 0} for s in subjects}

    # Build timetable map
    timetable_map = db.execute('SELECT id, subject_id FROM timetable').fetchall()
    tm_subject_map = {t['id']: t['subject_id'] for t in timetable_map}

    # Query attendance in the window, excluding holidays
    records = db.execute('''
        SELECT a.timetable_id, a.status, a.date
        FROM attendance a
        LEFT JOIN holidays h ON a.date = h.date
        WHERE h.date IS NULL
          AND a.date BETWEEN ? AND ?
    ''', (start_str, end_str)).fetchall()

    for r in records:
        sid = tm_subject_map.get(r['timetable_id'])
        if sid and sid in subjects_dict:
            if r['status'] in ['attended', 'missed']:
                subjects_dict[sid]['total'] += 1
            if r['status'] == 'attended':
                subjects_dict[sid]['attended'] += 1

    # Format response
    subjects_res = []
    for sid, data in subjects_dict.items():
        if data['total'] == 0:
            continue  # Skip subjects with no data in this window
        pct = (data['attended'] / data['total'] * 100)
        subjects_res.append({
            'id': sid,
            'name': data['name'],
            'attended': data['attended'],
            'total': data['total'],
            'percentage': round(pct, 1),
            'below_threshold': pct < 80
        })

    if not subjects_res:
        return jsonify({'error': 'No attendance records found in this date range.'}), 404

    return jsonify({'subjects': subjects_res, 'start': start_str, 'end': end_str})


@bp.route('/subjects', methods=['GET'])
def get_subjects():
    db = get_db()
    subjects = db.execute('SELECT * FROM subjects ORDER BY name').fetchall()
    return jsonify([dict(s) for s in subjects])

@bp.route('/subjects', methods=['POST'])
def add_subject():
    data = AddSubjectSchema().load(request.get_json() or {})
    db = get_db()
    db.execute('INSERT INTO subjects (name) VALUES (?)', (data['name'],))
    db.commit()
    return jsonify({'status': 'success'})
@bp.route('/timetable/<int:id>', methods=['PUT'])
def update_timetable_entry(id):
    data = UpdateTimetableSchema().load(request.get_json() or {})
    db = get_db()
    
    # Logic: Instead of updating `timetable`, we insert a `timetable_variations` record for the SPECIFIC DATE.
    # We need to calculate the specific date this slot refers to in the current week.
    
    # 1. Get the slot to know the day
    slot = db.execute('SELECT day_of_week FROM timetable WHERE id = ?', (id,)).fetchone()
    if not slot:
        return jsonify({'status': 'error', 'message': 'Slot not found'}), 404
        
    day_name = slot['day_of_week']
    
    # Calculate date for this day_name in current week
    today = datetime.now().date()
    start_of_week = today - timedelta(days=today.weekday())
    days_map = {'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4, 'Saturday': 5, 'Sunday': 6}
    
    target_date = start_of_week + timedelta(days=days_map[day_name])
    target_date_str = target_date.isoformat()

    # Handle Subject
    subject_name = data.get('subject_name')
    subject_id = None
    if subject_name:
        existing = db.execute('SELECT id FROM subjects WHERE name = ?', (subject_name,)).fetchone()
        if existing:
            subject_id = existing['id']
        else:
            cur = db.execute('INSERT INTO subjects (name) VALUES (?)', (subject_name,))
            subject_id = cur.lastrowid
            
    # Check if a variation already exists for this slot+date
    existing_var = db.execute('SELECT id FROM timetable_variations WHERE timetable_id = ? AND date = ?', (id, target_date_str)).fetchone()
    
    if existing_var:
        # Update existing variation
        db.execute('''
            UPDATE timetable_variations
            SET subject_id = COALESCE(?, subject_id),
                start_time = COALESCE(?, start_time),
                end_time = COALESCE(?, end_time),
                action = 'modify'
            WHERE id = ?
        ''', (subject_id, data.get('start'), data.get('end'), existing_var['id']))
    else:
        # Insert new variation
        db.execute('''
            INSERT INTO timetable_variations (timetable_id, date, subject_id, start_time, end_time, action)
            VALUES (?, ?, ?, ?, ?, 'modify')
        ''', (id, target_date_str, subject_id, data.get('start'), data.get('end')))
    
    db.commit()
    return jsonify({'status': 'success'})

@bp.route('/timetable/<int:id>', methods=['DELETE'])
def delete_timetable_entry(id):
    db = get_db()
    
    # Logic: Insert `timetable_variations` with action='delete' for CURRENT WEEK DATE.
    
    slot = db.execute('SELECT day_of_week FROM timetable WHERE id = ?', (id,)).fetchone()
    if not slot:
        return jsonify({'status': 'error', 'message': 'Slot not found'}), 404
        
    day_name = slot['day_of_week']
    
    today = datetime.now().date()
    start_of_week = today - timedelta(days=today.weekday())
    days_map = {'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4, 'Saturday': 5, 'Sunday': 6}
    
    target_date = start_of_week + timedelta(days=days_map[day_name])
    target_date_str = target_date.isoformat()
    
    # Check if variation exists
    existing_var = db.execute('SELECT id FROM timetable_variations WHERE timetable_id = ? AND date = ?', (id, target_date_str)).fetchone()
    
    if existing_var:
        db.execute("UPDATE timetable_variations SET action = 'delete' WHERE id = ?", (existing_var['id'],))
    else:
        db.execute('''
            INSERT INTO timetable_variations (timetable_id, date, action)
            VALUES (?, ?, 'delete')
        ''', (id, target_date_str))

    # Also clean up attendance for this specific date if it exists
    # (Since we are "hiding" the slot, we shouldn't have attendance records for it technically, 
    # or we can leave them as "orphaned" for history, but better to clear status so it doesn't count)
    db.execute('DELETE FROM attendance WHERE timetable_id = ? AND date = ?', (id, target_date_str))

    db.commit()
    return jsonify({'status': 'success'})
