import os
from flask import Flask, jsonify
from dotenv import load_dotenv
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from marshmallow import ValidationError

load_dotenv()

# Global rate limiter setup
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://" # Default is memory, explicitly configuring for clarity
)

def create_app(test_config=None):
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', os.urandom(24).hex()),
        DATABASE=os.path.join(app.instance_path, 'cockpit.db'),
    )

    if test_config is None:
        # load the instance config, if it exists, when not testing
        app.config.from_pyfile('config.py', silent=True)
    else:
        # load the test config if passed in
        app.config.from_mapping(test_config)

    # ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    from . import db
    db.init_app(app)
    limiter.init_app(app)

    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify({'error': 'Rate limit exceeded', 'message': str(e.description)}), 429

    @app.errorhandler(ValidationError)
    def handle_validation_error(e):
        return jsonify({'error': 'Validation failed', 'messages': e.messages}), 400

    # Register Blueprints
    from . import core
    app.register_blueprint(core.bp)
    
    from . import finance
    app.register_blueprint(finance.bp)
    
    from . import attendance
    app.register_blueprint(attendance.bp)
    
    from . import goals
    app.register_blueprint(goals.bp)
    
    from . import gym
    app.register_blueprint(gym.bp)
    
    from . import projects
    app.register_blueprint(projects.bp)
    
    from . import grades
    app.register_blueprint(grades.bp)

    from . import calendar
    app.register_blueprint(calendar.bp)

    return app
