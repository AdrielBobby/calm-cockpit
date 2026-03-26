from flask import Blueprint, jsonify, request
from app.db import get_db
from datetime import datetime, timedelta
from marshmallow import Schema, fields, validate, RAISE

bp = Blueprint('goals', __name__, url_prefix='/api/goals')

class AddGoalSchema(Schema):
    class Meta:
        unknown = RAISE
    text = fields.String(required=True, validate=validate.Length(min=1, max=500))
    notes = fields.String(validate=validate.Length(max=2000))

class UpdateGoalSchema(Schema):
    class Meta:
        unknown = RAISE
    text = fields.String(validate=validate.Length(min=1, max=500))
    is_completed = fields.Boolean()

def get_week_start_date():
    today = datetime.now().date()
    return (today - timedelta(days=today.weekday())).isoformat()

@bp.route('/', methods=['GET'])
def get_goals():
    db = get_db()
    week_start = get_week_start_date()
    
    goals = db.execute('SELECT * FROM weekly_goals WHERE week_start_date = ?', (week_start,)).fetchall()
    
    goals_list = [dict(g) for g in goals]
    
    total = len(goals_list)
    completed = sum(1 for g in goals_list if g['is_completed'])
    percentage = (completed / total * 100) if total > 0 else 0
    
    return jsonify({
        'week_start': week_start,
        'goals': goals_list,
        'percentage': round(percentage)
    })

@bp.route('/', methods=['POST'])
def add_goal():
    data = AddGoalSchema().load(request.get_json() or {})
    db = get_db()
    week_start = get_week_start_date()
    
    db.execute('INSERT INTO weekly_goals (week_start_date, text, notes) VALUES (?, ?, ?)',
               (week_start, data['text'], data.get('notes', '')))
    db.commit()
    return jsonify({'status': 'success'})

@bp.route('/<int:id>', methods=['PATCH'])
def update_goal(id):
    data = UpdateGoalSchema().load(request.get_json() or {})
    db = get_db()
    
    fields = []
    values = []
    if 'is_completed' in data:
        fields.append('is_completed = ?')
        values.append(1 if data['is_completed'] else 0)
    if 'text' in data:
        fields.append('text = ?')
        values.append(data['text'])
        
    values.append(id)
    
    if fields:
        db.execute(f'UPDATE weekly_goals SET {", ".join(fields)} WHERE id = ?', values)
        db.commit()
        
    return jsonify({'status': 'success'})

@bp.route('/', methods=['DELETE'])
def reset_goals():
    db = get_db()
    db.execute('DELETE FROM weekly_goals')
    db.commit()
    return jsonify({'status': 'success'})
