from flask import Blueprint, jsonify, request
from app.db import get_db
from datetime import datetime, timedelta
from marshmallow import Schema, fields, validate, RAISE

bp = Blueprint('gym', __name__, url_prefix='/api/gym')

class GymFilterSchema(Schema):
    class Meta:
        unknown = RAISE
    exercise_name = fields.String(validate=validate.Length(max=255))

class WorkoutSetSchema(Schema):
    class Meta:
        unknown = RAISE
    exercise_name = fields.String(required=True, validate=validate.Length(min=1, max=255))
    sets = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=100))
    reps = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=1000))
    weight = fields.Float(allow_none=True)

class LogWorkoutSchema(Schema):
    class Meta:
        unknown = RAISE
    date = fields.String(required=True, validate=validate.Length(max=50))
    sets = fields.List(fields.Nested(WorkoutSetSchema), required=True)

@bp.route('/data', methods=['GET'])
def get_gym_data():
    db = get_db()
    
    args = GymFilterSchema().load(request.args)
    exercise_filter = args.get('exercise_name')

    if exercise_filter:
        days_range = 30 # Show monthly trend for specific exercise
    else:
        days_range = 7
        
    today = datetime.now().date()
    dates = [(today - timedelta(days=i)).isoformat() for i in range(days_range - 1, -1, -1)]

    exercises = db.execute('SELECT * FROM exercises ORDER BY name').fetchall()
    
    volume_data = []
    
    for d in dates:
        query = '''
            SELECT SUM(ws.reps * ws.sets * COALESCE(NULLIF(ws.weight, 0), 1)) as volume 
            FROM workouts w
            JOIN workout_sets ws ON w.id = ws.workout_id
            JOIN exercises e ON ws.exercise_id = e.id
            WHERE w.date = ?
        '''
        params = [d]
        
        if exercise_filter:
            query += ' AND e.name = ?'
            params.append(exercise_filter)
            
        res = db.execute(query, params).fetchone()
        volume_data.append({
            'date': d,
            'volume': res['volume'] if res and res['volume'] else 0
        })

    recent_workouts = db.execute('SELECT * FROM workouts ORDER BY date DESC LIMIT 5').fetchall()
    history = []
    
    for w in recent_workouts:
        sets = db.execute('''
            SELECT e.name, ws.sets, ws.reps, ws.weight 
            FROM workout_sets ws
            JOIN exercises e ON ws.exercise_id = e.id
            WHERE ws.workout_id = ?
        ''', (w['id'],)).fetchall()
        
        history.append({
            'date': w['date'],
            'sets': [dict(s) for s in sets]
        })

    return jsonify({
        'exercises': [dict(e) for e in exercises],
        'volume_data': volume_data, 
        'history': history,
        'filter': exercise_filter
    })

@bp.route('/log', methods=['POST'])
def log_workout():
    data = LogWorkoutSchema().load(request.get_json() or {})
    db = get_db()
    
    cur = db.cursor()
    cur.execute('INSERT INTO workouts (date) VALUES (?)', (data['date'],))
    workout_id = cur.lastrowid
    
    for s in data['sets']:
        ex_row = db.execute('SELECT id FROM exercises WHERE name = ?', (s['exercise_name'],)).fetchone()
        if not ex_row:
            cur.execute('INSERT INTO exercises (name) VALUES (?)', (s['exercise_name'],))
            exercise_id = cur.lastrowid
        else:
            exercise_id = ex_row['id']
            
        cur.execute('''
            INSERT INTO workout_sets (workout_id, exercise_id, sets, reps, weight)
            VALUES (?, ?, ?, ?, ?)
        ''', (workout_id, exercise_id, s['sets'], s['reps'], s.get('weight')))
    
    db.commit()
    return jsonify({'status': 'success'})
