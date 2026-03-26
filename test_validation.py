import sys
import json
from app import create_app

app = create_app()
client = app.test_client()

with open('test_results.txt', 'w') as f:
    f.write(f"Attendance GET status: {client.get('/api/attendance/data').status_code}\n")
    f.write(f"Projects GET status: {client.get('/api/projects/summary').status_code}\n")
    
    res = client.post('/api/calendar/event', json={'title': 'Test Event', 'date': '2026-03-23'})
    f.write(f"Calendar POST (valid) status: {res.status_code}\n")
    
    res = client.post('/api/calendar/event', json={'title': 'Test Event', 'date': '2026-03-23', 'label': 'InvalidLabel'})
    f.write(f"Calendar POST (invalid label) status: {res.status_code}\n")
    
    res = client.post('/api/calendar/event', json={'title': 'Test Event', 'date': '2026-03-23', 'hacker_field': 'malicious'})
    f.write(f"Calendar POST (unknown field) status: {res.status_code}\n")
    
    statuses = [client.get('/api/projects/summary').status_code for _ in range(55)]
    f.write(f"Rate Limit 200s: {statuses.count(200)}\n")
    f.write(f"Rate Limit 429s: {statuses.count(429)}\n")
