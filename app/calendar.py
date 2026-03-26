from flask import Blueprint, jsonify, request
from app.db import get_db
from marshmallow import Schema, fields, validate, RAISE

bp = Blueprint('calendar', __name__, url_prefix='/api/calendar')

VALID_LABELS = ['Personal', 'Exam', 'Project', 'Gym', 'Study', 'Other']
VALID_STATUSES = ['planned', 'in_progress', 'done']

class EventSchema(Schema):
    class Meta:
        unknown = RAISE
    title = fields.String(required=True, validate=validate.Length(min=1, max=255))
    date = fields.String(required=True, validate=validate.Length(max=50))
    description = fields.String(allow_none=True, validate=validate.Length(max=2000))
    start_time = fields.String(allow_none=True, validate=validate.Length(max=50))
    end_time = fields.String(allow_none=True, validate=validate.Length(max=50))
    label = fields.String(validate=validate.OneOf(VALID_LABELS))
    status = fields.String(validate=validate.OneOf(VALID_STATUSES))

class UpdateEventSchema(Schema):
    class Meta:
        unknown = RAISE
    title = fields.String(validate=validate.Length(min=1, max=255))
    date = fields.String(validate=validate.Length(max=50))
    description = fields.String(allow_none=True, validate=validate.Length(max=2000))
    start_time = fields.String(allow_none=True, validate=validate.Length(max=50))
    end_time = fields.String(allow_none=True, validate=validate.Length(max=50))
    label = fields.String(validate=validate.OneOf(VALID_LABELS))
    status = fields.String(validate=validate.OneOf(VALID_STATUSES))


@bp.route('/events', methods=['GET'])
def get_events():
    db = get_db()
    month = request.args.get('month', '').strip()  # Expected: YYYY-MM

    if not month or len(month) != 7:
        return jsonify({'error': 'month param required in YYYY-MM format'}), 400

    # Match all dates starting with YYYY-MM
    like_pattern = month + '-%'
    events = db.execute(
        'SELECT * FROM events WHERE date LIKE ? ORDER BY date, start_time',
        (like_pattern,)
    ).fetchall()

    return jsonify([dict(e) for e in events])


@bp.route('/event', methods=['POST'])
def create_event():
    data = EventSchema().load(request.get_json() or {})

    label = data.get('label', 'Personal')
    status = data.get('status', 'planned')

    db = get_db()
    cur = db.execute(
        'INSERT INTO events (title, description, date, start_time, end_time, label, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (
            data['title'].strip(),
            data.get('description', '').strip() if data.get('description') else None,
            data['date'],
            data.get('start_time', '').strip() if data.get('start_time') else None,
            data.get('end_time', '').strip() if data.get('end_time') else None,
            label,
            status,
        )
    )
    db.commit()
    return jsonify({'status': 'success', 'id': cur.lastrowid})


@bp.route('/event/<int:id>/update', methods=['POST'])
def update_event(id):
    data = UpdateEventSchema().load(request.get_json() or {})
    db = get_db()

    event = db.execute('SELECT id FROM events WHERE id = ?', (id,)).fetchone()
    if not event:
        return jsonify({'error': 'Event not found'}), 404

    label = data.get('label')
    status = data.get('status')

    db.execute('''
        UPDATE events SET
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            date = COALESCE(?, date),
            start_time = COALESCE(?, start_time),
            end_time = COALESCE(?, end_time),
            label = COALESCE(?, label),
            status = COALESCE(?, status)
        WHERE id = ?
    ''', (
        data.get('title', '').strip() if data.get('title') is not None else None,
        data.get('description', '').strip() if data.get('description') is not None else None,
        data.get('date') or None,
        data.get('start_time', '').strip() if data.get('start_time') is not None else None,
        data.get('end_time', '').strip() if data.get('end_time') is not None else None,
        label,
        status,
        id,
    ))
    db.commit()
    return jsonify({'status': 'success'})


@bp.route('/event/<int:id>/delete', methods=['POST'])
def delete_event(id):
    db = get_db()
    db.execute('DELETE FROM events WHERE id = ?', (id,))
    db.commit()
    return jsonify({'status': 'success'})
