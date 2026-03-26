from app import create_app

app = create_app()

if __name__ == '__main__':
    # Listen on all network interfaces (0.0.0.0) to allow access from other devices (like iPhone) 
    # while they are on the same Wi-Fi. Access via: http://192.168.0.245:5000
    app.run(host='0.0.0.0', port=5000, debug=True)
