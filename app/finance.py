from flask import Blueprint, jsonify, request
from app.db import get_db
from datetime import datetime
from marshmallow import Schema, fields, validate, RAISE

bp = Blueprint('finance', __name__, url_prefix='/api/finance')

class AddTransactionSchema(Schema):
    class Meta:
        unknown = RAISE
    account_id = fields.Integer(required=True, strict=True)
    type = fields.String(required=True, validate=validate.OneOf(['income', 'expense']))
    amount = fields.Float(required=True)
    date = fields.String(required=True, validate=validate.Length(max=50))
    category = fields.String(validate=validate.Length(max=100))
    note = fields.String(validate=validate.Length(max=500))

@bp.route('/data', methods=['GET'])
def get_finance_data():
    db = get_db()
    
    accounts = db.execute('SELECT id, name, type FROM accounts').fetchall()
    
    accounts_data = []
    total_net_worth = 0.0
    
    for row in accounts:
        balance_row = db.execute('''
            SELECT 
                SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as balance
            FROM transactions 
            WHERE account_id = ?
        ''', (row['id'],)).fetchone()
        
        balance = balance_row['balance'] if balance_row['balance'] is not None else 0.0
        
        accounts_data.append({
            'id': row['id'],
            'name': row['name'],
            'type': row['type'],
            'balance': balance
        })
        total_net_worth += balance

    current_month_str = datetime.now().strftime('%Y-%m')
    
    monthly_stats = db.execute('''
        SELECT 
            type, SUM(amount) as total
        FROM transactions
        WHERE date LIKE ?
        GROUP BY type
    ''', (f'{current_month_str}%',)).fetchall()
    
    monthly_income = 0.0
    monthly_expense = 0.0
    
    for row in monthly_stats:
        if row['type'] == 'income':
            monthly_income = row['total']
        elif row['type'] == 'expense':
            monthly_expense = row['total']

    return jsonify({
        'accounts': accounts_data,
        'net_worth': total_net_worth,
        'monthly_stats': {
            'income': monthly_income,
            'expense': monthly_expense
        }
    })

@bp.route('/transactions', methods=['POST'])
def add_transaction():
    data = AddTransactionSchema().load(request.get_json() or {})
    db = get_db()
    
    db.execute(
        'INSERT INTO transactions (account_id, date, type, amount, category, note) VALUES (?, ?, ?, ?, ?, ?)',
        (data['account_id'], data['date'], data['type'], float(data['amount']), data.get('category', ''), data.get('note', ''))
    )
    db.commit()
    
    return jsonify({'status': 'success'})

@bp.route('/reset', methods=['DELETE'])
def reset_data():
    db = get_db()
    db.execute('DELETE FROM transactions')
    db.commit()
    return jsonify({'status': 'success'})
