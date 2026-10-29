from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash, check_password_hash
import os
from datetime import datetime
import stripe
from dotenv import load_dotenv
from flask_migrate import Migrate

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///ludo.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
socketio = SocketIO(app)
migrate = Migrate(app, db)

# Stripe configuration
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

# Database Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    coins = db.Column(db.Integer, default=1000)
    real_money_balance = db.Column(db.Float, default=0.0)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    wins = db.Column(db.Integer, default=0)
    games_played = db.Column(db.Integer, default=0)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Game(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    game_type = db.Column(db.String(20), nullable=False)  # 'free' or 'bet'
    bet_amount = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default='active')  # active, completed, cancelled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    players = db.relationship('GamePlayer', backref='game', lazy=True)

class GamePlayer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey('game.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    position = db.Column(db.Integer, nullable=False)
    color = db.Column(db.String(20), nullable=False)
    coins_won = db.Column(db.Integer, default=0)
    real_money_won = db.Column(db.Float, default=0.0)

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # deposit, withdrawal, bet, win
    amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, completed, failed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        user = User.query.filter_by(username=request.form.get('username')).first()
        if user and user.check_password(request.form.get('password')):
            login_user(user)
            return redirect(url_for('dashboard'))
        flash('Invalid username or password')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        user = User(
            username=request.form.get('username'),
            email=request.form.get('email'),
            coins=1000,  # Initialize with default coins
            real_money_balance=0.0,  # Initialize with 0 balance
            wins=0,  # Initialize with 0 wins
            games_played=0  # Initialize with 0 games played
        )
        user.set_password(request.form.get('password'))
        db.session.add(user)
        db.session.commit()
        flash('Registration successful! Please login.', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out successfully', 'success')
    return redirect(url_for('index'))

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

@app.route('/game/free')
@login_required
def free_play():
    return render_template('game.html', game_type='free')

@app.route('/game/bet')
@login_required
def bet_play():
    return render_template('game.html', game_type='bet')

@app.route('/admin')
@login_required
def admin_panel():
    if not current_user.is_admin:
        return redirect(url_for('dashboard'))
    return render_template('admin.html')

@app.route('/leaderboard')
@login_required
def leaderboard():
    # Get top players by wins, handling None values
    top_players = User.query.order_by(
        db.func.coalesce(User.wins, 0).desc(),
        db.func.coalesce(User.games_played, 0).desc()
    ).limit(10).all()
    return render_template('leaderboard.html', players=top_players)

@app.route('/profile')
@login_required
def profile():
    return render_template('profile.html')

@app.route('/settings', methods=['GET', 'POST'])
@login_required
def settings():
    if request.method == 'POST':
        # Update email
        if request.form.get('email') != current_user.email:
            current_user.email = request.form.get('email')
        
        # Update password
        current_password = request.form.get('current_password')
        new_password = request.form.get('new_password')
        confirm_password = request.form.get('confirm_password')
        
        if current_password and new_password and confirm_password:
            if current_user.check_password(current_password):
                if new_password == confirm_password:
                    current_user.set_password(new_password)
                    flash('Password updated successfully', 'success')
                else:
                    flash('New passwords do not match', 'danger')
            else:
                flash('Current password is incorrect', 'danger')
        
        # Save changes
        db.session.commit()
        flash('Settings updated successfully', 'success')
        return redirect(url_for('settings'))
    
    return render_template('settings.html')

# Socket.IO events
@socketio.on('join_game')
def on_join(data):
    room = data['room']
    join_room(room)
    emit('status', {'msg': f'Player joined the room'}, room=room)

@socketio.on('leave_game')
def on_leave(data):
    room = data['room']
    leave_room(room)
    emit('status', {'msg': f'Player left the room'}, room=room)

@socketio.on('make_move')
def on_move(data):
    room = data['room']
    emit('move', data, room=room)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    socketio.run(app, debug=True) 