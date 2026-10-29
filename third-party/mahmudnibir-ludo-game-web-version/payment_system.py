import stripe
from typing import Dict, Optional
from datetime import datetime
from decimal import Decimal
import os
from dotenv import load_dotenv

load_dotenv()

class PaymentSystem:
    def __init__(self):
        stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
        self.platform_fee_percentage = Decimal('0.05')  # 5% platform fee

    def create_deposit_intent(self, amount: float, currency: str = 'usd') -> Dict:
        """Create a payment intent for depositing money"""
        try:
            intent = stripe.PaymentIntent.create(
                amount=int(amount * 100),  # Convert to cents
                currency=currency,
                payment_method_types=['card'],
                metadata={'type': 'deposit'}
            )
            return {
                'success': True,
                'client_secret': intent.client_secret,
                'payment_intent_id': intent.id
            }
        except stripe.error.StripeError as e:
            return {
                'success': False,
                'error': str(e)
            }

    def process_withdrawal(self, amount: float, user_id: str, currency: str = 'usd') -> Dict:
        """Process a withdrawal request"""
        try:
            # Create a transfer to the user's connected account
            transfer = stripe.Transfer.create(
                amount=int(amount * 100),  # Convert to cents
                currency=currency,
                destination=user_id,  # User's Stripe account ID
                transfer_group=f'withdrawal_{datetime.now().timestamp()}'
            )
            return {
                'success': True,
                'transfer_id': transfer.id
            }
        except stripe.error.StripeError as e:
            return {
                'success': False,
                'error': str(e)
            }

    def process_bet_payment(self, bet_amount: float, players: list, currency: str = 'usd') -> Dict:
        """Process bet payments from all players"""
        try:
            total_amount = bet_amount * len(players)
            # Create a payment intent for the total bet amount
            intent = stripe.PaymentIntent.create(
                amount=int(total_amount * 100),  # Convert to cents
                currency=currency,
                payment_method_types=['card'],
                metadata={
                    'type': 'bet',
                    'player_count': len(players),
                    'bet_amount': bet_amount
                }
            )
            return {
                'success': True,
                'client_secret': intent.client_secret,
                'payment_intent_id': intent.id
            }
        except stripe.error.StripeError as e:
            return {
                'success': False,
                'error': str(e)
            }

    def process_win_payment(self, total_pot: float, winner_id: str, currency: str = 'usd') -> Dict:
        """Process payment to the winner"""
        try:
            # Calculate winner's amount after platform fee
            winner_amount = total_pot * (1 - self.platform_fee_percentage)
            
            # Create a transfer to the winner's account
            transfer = stripe.Transfer.create(
                amount=int(winner_amount * 100),  # Convert to cents
                currency=currency,
                destination=winner_id,  # Winner's Stripe account ID
                transfer_group=f'win_{datetime.now().timestamp()}'
            )
            return {
                'success': True,
                'transfer_id': transfer.id,
                'amount': winner_amount
            }
        except stripe.error.StripeError as e:
            return {
                'success': False,
                'error': str(e)
            }

    def verify_payment(self, payment_intent_id: str) -> Dict:
        """Verify the status of a payment"""
        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            return {
                'success': True,
                'status': intent.status,
                'amount': intent.amount / 100,  # Convert from cents
                'currency': intent.currency
            }
        except stripe.error.StripeError as e:
            return {
                'success': False,
                'error': str(e)
            }

    def create_connected_account(self, user_data: Dict) -> Dict:
        """Create a Stripe connected account for a user"""
        try:
            account = stripe.Account.create(
                type='express',
                email=user_data.get('email'),
                business_profile={
                    'name': user_data.get('username'),
                    'url': None
                },
                capabilities={
                    'card_payments': {'requested': True},
                    'transfers': {'requested': True}
                }
            )
            return {
                'success': True,
                'account_id': account.id,
                'onboarding_url': account.links.standard.url
            }
        except stripe.error.StripeError as e:
            return {
                'success': False,
                'error': str(e)
            }

    def get_account_balance(self, account_id: str) -> Dict:
        """Get the balance of a connected account"""
        try:
            balance = stripe.Balance.retrieve(stripe_account=account_id)
            return {
                'success': True,
                'balance': balance.available[0].amount / 100,  # Convert from cents
                'currency': balance.available[0].currency
            }
        except stripe.error.StripeError as e:
            return {
                'success': False,
                'error': str(e)
            } 