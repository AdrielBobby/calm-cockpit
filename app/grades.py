from flask import Blueprint, jsonify, request
from app.db import get_db
from marshmallow import Schema, fields, validate, RAISE

bp = Blueprint('grades', __name__, url_prefix='/api/grades')

class SgpaSchema(Schema):
    class Meta:
        unknown = RAISE
    number = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=20))
    sgpa = fields.Float(required=True, validate=validate.Range(min=0.0, max=10.0))

class GradeConfigSchema(Schema):
    class Meta:
        unknown = RAISE
    semester_id = fields.Integer()
    subject_index = fields.Integer(required=True, strict=True, validate=validate.Range(min=0, max=10))
    name = fields.String(required=True, validate=validate.Length(min=1, max=255))

class InternalMarkSchema(Schema):
    class Meta:
        unknown = RAISE
    semester_id = fields.Integer()
    subject_index = fields.Integer(required=True, strict=True, validate=validate.Range(min=0, max=10))
    internal_number = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=10))
    mark = fields.Float(required=True, validate=validate.Range(min=0.0, max=100.0))

class ClearInternalsSchema(Schema):
    class Meta:
        unknown = RAISE
    semester_id = fields.Integer()

@bp.route('/sgpa', methods=['GET'])
def get_sgpa_data():
    db = get_db()
    semesters = db.execute('SELECT * FROM semesters ORDER BY number').fetchall()
    
    sems_list = [dict(s) for s in semesters]
    
    if sems_list:
        total_sgpa = sum(s['sgpa'] for s in sems_list)
        cgpa = total_sgpa / len(sems_list)
    else:
        cgpa = 0.0
        
    return jsonify({
        'semesters': sems_list,
        'cgpa': round(cgpa, 2)
    })

@bp.route('/sgpa', methods=['POST'])
def add_update_sgpa():
    data = SgpaSchema().load(request.get_json() or {})
    db = get_db()
    
    existing = db.execute('SELECT id FROM semesters WHERE number = ?', (data['number'],)).fetchone()
    
    if existing:
        db.execute('UPDATE semesters SET sgpa = ? WHERE id = ?', (data['sgpa'], existing['id']))
    else:
        db.execute('INSERT INTO semesters (number, sgpa) VALUES (?, ?)', (data['number'], data['sgpa']))
        
    db.commit()
    return jsonify({'status': 'success'})

@bp.route('/sgpa', methods=['DELETE'])
def reset_sgpa():
    db = get_db()
    db.execute('DELETE FROM semesters')
    db.commit()
    return jsonify({'status': 'success'})

@bp.route('/internals', methods=['GET'])
def get_internals():
    db = get_db()
    
    max_sem = db.execute('SELECT MAX(id) as id FROM semesters').fetchone()
    current_sem_id = max_sem['id'] if max_sem and max_sem['id'] else 1 
    
    marks = db.execute('SELECT * FROM internal_marks WHERE semester_id = ?', (current_sem_id,)).fetchall()
    
    sub_names_rows = db.execute('SELECT subject_index, name FROM grade_subject_names WHERE semester_id = ?', (current_sem_id,)).fetchall()
    sub_names = {row['subject_index']: row['name'] for row in sub_names_rows}
    
    matrix = {}
    for m in marks:
        matrix[f"{m['subject_index']}_{m['internal_number']}"] = m['mark']
        
    return jsonify({
        'semester_id': current_sem_id,
        'marks': matrix,
        'subject_names': sub_names
    })

@bp.route('/config', methods=['POST'])
def save_config():
    data = GradeConfigSchema().load(request.get_json() or {})
    db = get_db()
    
    semester_id = data.get('semester_id')
    if not semester_id:
         max_sem = db.execute('SELECT MAX(id) as id FROM semesters').fetchone()
         semester_id = max_sem['id'] if max_sem and max_sem['id'] else 1

    db.execute('''
        INSERT INTO grade_subject_names (semester_id, subject_index, name)
        VALUES (?, ?, ?)
        ON CONFLICT(semester_id, subject_index) DO UPDATE SET name=excluded.name
    ''', (semester_id, data['subject_index'], data['name']))
    db.commit()
    return jsonify({'status': 'success'})

@bp.route('/internals', methods=['POST'])
def update_internal_mark():
    data = InternalMarkSchema().load(request.get_json() or {})
    db = get_db()
    
    semester_id = data.get('semester_id')
    if not semester_id:
        max_sem = db.execute('SELECT MAX(id) as id FROM semesters').fetchone()
        semester_id = max_sem['id'] if max_sem and max_sem['id'] else 1

    db.execute('''
        INSERT INTO internal_marks (semester_id, subject_index, internal_number, mark)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(semester_id, subject_index, internal_number) DO UPDATE SET mark=excluded.mark
    ''', (semester_id, data['subject_index'], data['internal_number'], data['mark']))
    
    db.commit()
    return jsonify({'status': 'success'})

@bp.route('/internals/clear', methods=['POST'])
def clear_internals():
    data = ClearInternalsSchema().load(request.get_json() or {})
    db = get_db()
    
    semester_id = data.get('semester_id')
    if not semester_id:
        max_sem = db.execute('SELECT MAX(id) as id FROM semesters').fetchone()
        semester_id = max_sem['id'] if max_sem and max_sem['id'] else 1
        
    db.execute('DELETE FROM internal_marks WHERE semester_id = ?', (semester_id,))
    db.commit()
    return jsonify({'status': 'success'})
