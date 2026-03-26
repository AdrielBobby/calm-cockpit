from flask import Blueprint, jsonify, request
from app.db import get_db
from datetime import datetime
from marshmallow import Schema, fields, validate, RAISE

bp = Blueprint('projects', __name__, url_prefix='/api/projects')

class ProjectSchema(Schema):
    class Meta:
        unknown = RAISE
    name = fields.String(required=True, validate=validate.Length(min=1, max=255))
    priority = fields.String(validate=validate.Length(max=50))
    target_date = fields.String(validate=validate.Length(max=50))

class ProjectLogSchema(Schema):
    class Meta:
        unknown = RAISE
    date = fields.String(required=True, validate=validate.Length(max=50))
    note = fields.String(required=True, validate=validate.Length(min=1, max=2000))
    state = fields.String(validate=validate.Length(max=50))

class ProjectUpdateSchema(Schema):
    class Meta:
        unknown = RAISE
    status = fields.String(validate=validate.Length(max=50))
    name = fields.String(validate=validate.Length(min=1, max=255))

@bp.route('/', methods=['GET'])
def get_projects():
    db = get_db()
    # Get all projects
    projects = db.execute('SELECT * FROM projects ORDER BY last_updated DESC').fetchall()
    
    projects_list = []
    for p in projects:
        # Get latest log for snippet
        latest_log = db.execute('SELECT * FROM project_logs WHERE project_id = ? ORDER BY date DESC LIMIT 1', (p['id'],)).fetchone()
        
        projects_list.append({
            'id': p['id'],
            'name': p['name'],
            'status': p['status'],
            'priority': p['priority'],
            'started_date': p['started_date'],
            'target_date': p['target_date'],
            'latest_log': dict(latest_log) if latest_log else None
        })
        
    return jsonify(projects_list)

@bp.route('/', methods=['POST'])
def add_project():
    data = ProjectSchema().load(request.get_json() or {})
    db = get_db()
    
    now = datetime.now().isoformat()
    db.execute('INSERT INTO projects (name, status, priority, started_date, target_date, last_updated) VALUES (?, ?, ?, ?, ?, ?)',
               (data['name'], 'planned', data.get('priority', 'medium'), now, data.get('target_date'), now))
    db.commit()
    return jsonify({'status': 'success'})

@bp.route('/<int:id>/logs', methods=['GET'])
def get_project_logs(id):
    db = get_db()
    logs = db.execute('SELECT * FROM project_logs WHERE project_id = ? ORDER BY date DESC', (id,)).fetchall()
    return jsonify([dict(l) for l in logs])

@bp.route('/<int:id>/logs', methods=['POST'])
def add_log(id):
    data = ProjectLogSchema().load(request.get_json() or {})
    db = get_db()
    
    db.execute('INSERT INTO project_logs (project_id, date, note, state) VALUES (?, ?, ?, ?)',
               (id, data['date'], data['note'], data.get('state', '')))
    
    # Update project last_updated
    db.execute('UPDATE projects SET last_updated = ? WHERE id = ?', (data['date'], id))
    db.commit()
    return jsonify({'status': 'success'})

@bp.route('/<int:id>', methods=['PATCH'])
def update_project(id):
    data = ProjectUpdateSchema().load(request.get_json() or {})
    db = get_db()
    
    if 'status' in data:
        db.execute('UPDATE projects SET status = ? WHERE id = ?', (data['status'], id))
    
    if 'name' in data:
        db.execute('UPDATE projects SET name = ? WHERE id = ?', (data['name'], id))
    
    db.commit()
    db.commit()
    return jsonify({'status': 'success'})

@bp.route('/<int:id>', methods=['DELETE'])
def delete_project(id):
    db = get_db()
    db.execute('DELETE FROM projects WHERE id = ?', (id,))
    db.execute('DELETE FROM project_logs WHERE project_id = ?', (id,))
    db.commit()
    return jsonify({'status': 'success'})
