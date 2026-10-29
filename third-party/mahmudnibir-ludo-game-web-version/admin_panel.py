from typing import Dict, List, Optional
from datetime import datetime, timedelta
from decimal import Decimal
import json

class AdminPanel:
    def __init__(self, db):
        self.db = db

    def get_user_stats(self, user_id: str) -> Dict:
        """Get statistics for a specific user"""
        user = self.db.User.query.get(user_id)
        if not user:
            return {'success': False, 'error': 'User not found'}

        # Get user's game history
        games = self.db.Game.query.filter_by(user_id=user_id).all()
        total_games = len(games)
        wins = sum(1 for game in games if game.winner_id == user_id)
        win_rate = (wins / total_games * 100) if total_games > 0 else 0

        # Get transaction history
        transactions = self.db.Transaction.query.filter_by(user_id=user_id).all()
        total_deposits = sum(t.amount for t in transactions if t.type == 'deposit')
        total_withdrawals = sum(t.amount for t in transactions if t.type == 'withdrawal')
        total_bets = sum(t.amount for t in transactions if t.type == 'bet')
        total_wins = sum(t.amount for t in transactions if t.type == 'win')

        return {
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'coins': user.coins,
                'real_money_balance': user.real_money_balance,
                'is_admin': user.is_admin,
                'created_at': user.created_at.isoformat()
            },
            'stats': {
                'total_games': total_games,
                'wins': wins,
                'win_rate': win_rate,
                'total_deposits': total_deposits,
                'total_withdrawals': total_withdrawals,
                'total_bets': total_bets,
                'total_wins': total_wins
            }
        }

    def get_platform_stats(self, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> Dict:
        """Get platform-wide statistics"""
        if not start_date:
            start_date = datetime.now() - timedelta(days=30)
        if not end_date:
            end_date = datetime.now()

        # Get transaction statistics
        transactions = self.db.Transaction.query.filter(
            self.db.Transaction.created_at.between(start_date, end_date)
        ).all()

        total_deposits = sum(t.amount for t in transactions if t.type == 'deposit')
        total_withdrawals = sum(t.amount for t in transactions if t.type == 'withdrawal')
        total_bets = sum(t.amount for t in transactions if t.type == 'bet')
        total_wins = sum(t.amount for t in transactions if t.type == 'win')
        platform_fees = sum(t.amount * Decimal('0.05') for t in transactions if t.type == 'win')

        # Get user statistics
        total_users = self.db.User.query.count()
        active_users = self.db.User.query.filter(
            self.db.User.last_login >= start_date
        ).count()

        # Get game statistics
        games = self.db.Game.query.filter(
            self.db.Game.created_at.between(start_date, end_date)
        ).all()
        total_games = len(games)
        completed_games = sum(1 for game in games if game.status == 'completed')

        return {
            'success': True,
            'period': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            },
            'transactions': {
                'total_deposits': total_deposits,
                'total_withdrawals': total_withdrawals,
                'total_bets': total_bets,
                'total_wins': total_wins,
                'platform_fees': platform_fees
            },
            'users': {
                'total': total_users,
                'active': active_users
            },
            'games': {
                'total': total_games,
                'completed': completed_games
            }
        }

    def manage_user(self, user_id: str, action: str, data: Optional[Dict] = None) -> Dict:
        """Manage user account (ban/unban, reset, etc.)"""
        user = self.db.User.query.get(user_id)
        if not user:
            return {'success': False, 'error': 'User not found'}

        if action == 'ban':
            user.is_banned = True
            user.ban_reason = data.get('reason')
            user.banned_at = datetime.now()
        elif action == 'unban':
            user.is_banned = False
            user.ban_reason = None
            user.banned_at = None
        elif action == 'reset':
            user.coins = 1000  # Reset to initial amount
            user.real_money_balance = 0
        elif action == 'add_coins':
            user.coins += data.get('amount', 0)
        elif action == 'remove_coins':
            user.coins = max(0, user.coins - data.get('amount', 0))
        else:
            return {'success': False, 'error': 'Invalid action'}

        self.db.session.commit()
        return {'success': True, 'message': f'User {action} successful'}

    def get_pending_withdrawals(self) -> List[Dict]:
        """Get list of pending withdrawal requests"""
        withdrawals = self.db.Transaction.query.filter_by(
            type='withdrawal',
            status='pending'
        ).order_by(self.db.Transaction.created_at.desc()).all()

        return [{
            'id': w.id,
            'user_id': w.user_id,
            'amount': w.amount,
            'created_at': w.created_at.isoformat(),
            'status': w.status
        } for w in withdrawals]

    def process_withdrawal(self, withdrawal_id: str, action: str, admin_id: str) -> Dict:
        """Process a withdrawal request (approve/reject)"""
        withdrawal = self.db.Transaction.query.get(withdrawal_id)
        if not withdrawal:
            return {'success': False, 'error': 'Withdrawal not found'}

        if withdrawal.status != 'pending':
            return {'success': False, 'error': 'Withdrawal already processed'}

        if action == 'approve':
            withdrawal.status = 'completed'
            withdrawal.processed_at = datetime.now()
            withdrawal.processed_by = admin_id
            # Process the actual payment through payment system
            # This should be handled by the payment system module
        elif action == 'reject':
            withdrawal.status = 'rejected'
            withdrawal.processed_at = datetime.now()
            withdrawal.processed_by = admin_id
            # Refund the amount back to user's balance
            user = self.db.User.query.get(withdrawal.user_id)
            user.real_money_balance += withdrawal.amount
        else:
            return {'success': False, 'error': 'Invalid action'}

        self.db.session.commit()
        return {'success': True, 'message': f'Withdrawal {action} successful'}

    def get_suspicious_activities(self) -> List[Dict]:
        """Get list of suspicious activities for review"""
        # Implement suspicious activity detection logic
        # This could include:
        # - Multiple failed login attempts
        # - Unusual betting patterns
        # - Multiple accounts from same IP
        # - Rapid coin accumulation
        # - etc.
        return []

    def update_game_settings(self, settings: Dict) -> Dict:
        """Update game settings (bet limits, coin rewards, etc.)"""
        try:
            # Store settings in database or configuration file
            # This could be implemented using a Settings model or a configuration file
            return {'success': True, 'message': 'Settings updated successfully'}
        except Exception as e:
            return {'success': False, 'error': str(e)} 