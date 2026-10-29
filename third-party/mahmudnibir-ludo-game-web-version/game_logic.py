import random
from typing import List, Dict, Tuple
import json

class LudoGame:
    def __init__(self, game_id: str, players: List[Dict]):
        self.game_id = game_id
        self.players = players
        self.current_turn = 0
        self.game_state = {
            'board': self._initialize_board(),
            'player_positions': self._initialize_positions(),
            'dice_value': None,
            'game_status': 'waiting',  # waiting, active, completed
            'winner': None
        }
        self.colors = ['red', 'green', 'yellow', 'blue']
        self.start_positions = {
            'red': (0, 0),
            'green': (0, 13),
            'yellow': (13, 13),
            'blue': (13, 0)
        }
        self.home_positions = {
            'red': [(1, 1), (1, 2), (2, 1), (2, 2)],
            'green': [(1, 11), (1, 12), (2, 11), (2, 12)],
            'yellow': [(11, 11), (11, 12), (12, 11), (12, 12)],
            'blue': [(11, 1), (11, 2), (12, 1), (12, 2)]
        }

    def _initialize_board(self) -> List[List[int]]:
        """Initialize the Ludo board with empty spaces (0)"""
        return [[0 for _ in range(15)] for _ in range(15)]

    def _initialize_positions(self) -> Dict:
        """Initialize player positions"""
        positions = {}
        for player in self.players:
            positions[player['id']] = {
                'color': player['color'],
                'tokens': [{'position': pos, 'is_home': True} for pos in self.home_positions[player['color']]]
            }
        return positions

    def roll_dice(self) -> int:
        """Roll the dice and return a random number between 1 and 6"""
        self.game_state['dice_value'] = random.randint(1, 6)
        return self.game_state['dice_value']

    def is_valid_move(self, player_id: str, token_index: int) -> bool:
        """Check if the move is valid for the given player and token"""
        if self.game_state['dice_value'] is None:
            return False

        player = self.players[self.current_turn]
        if player['id'] != player_id:
            return False

        token = self.game_state['player_positions'][player_id]['tokens'][token_index]
        if token['is_home']:
            return self.game_state['dice_value'] == 6
        return True

    def make_move(self, player_id: str, token_index: int) -> Dict:
        """Make a move for the given player and token"""
        if not self.is_valid_move(player_id, token_index):
            return {'success': False, 'message': 'Invalid move'}

        token = self.game_state['player_positions'][player_id]['tokens'][token_index]
        dice_value = self.game_state['dice_value']

        if token['is_home']:
            # Move token out of home
            token['is_home'] = False
            token['position'] = self.start_positions[self.game_state['player_positions'][player_id]['color']]
        else:
            # Move token on the board
            new_position = self._calculate_new_position(token['position'], dice_value)
            if new_position:
                token['position'] = new_position
            else:
                return {'success': False, 'message': 'Invalid move'}

        # Check for captures
        self._check_captures(player_id, token_index)

        # Check for win
        if self._check_win(player_id):
            self.game_state['winner'] = player_id
            self.game_state['game_status'] = 'completed'

        # Update turn
        if dice_value != 6:
            self.current_turn = (self.current_turn + 1) % len(self.players)

        return {'success': True, 'game_state': self.game_state}

    def _calculate_new_position(self, current_pos: Tuple[int, int], steps: int) -> Tuple[int, int]:
        """Calculate the new position after moving the given number of steps"""
        # Implementation of position calculation based on Ludo rules
        # This is a simplified version - you'll need to implement the full logic
        x, y = current_pos
        # Add your position calculation logic here
        return (x, y)  # Placeholder return

    def _check_captures(self, player_id: str, token_index: int):
        """Check and handle token captures"""
        current_token = self.game_state['player_positions'][player_id]['tokens'][token_index]
        current_color = self.game_state['player_positions'][player_id]['color']

        for other_player_id, other_player_data in self.game_state['player_positions'].items():
            if other_player_id != player_id:
                for other_token in other_player_data['tokens']:
                    if not other_token['is_home'] and other_token['position'] == current_token['position']:
                        # Capture the token
                        other_token['is_home'] = True
                        other_token['position'] = self.home_positions[other_player_data['color']][0]

    def _check_win(self, player_id: str) -> bool:
        """Check if the player has won the game"""
        for token in self.game_state['player_positions'][player_id]['tokens']:
            if token['is_home']:
                return False
        return True

    def get_game_state(self) -> Dict:
        """Get the current game state"""
        return self.game_state

    def to_json(self) -> str:
        """Convert game state to JSON string"""
        return json.dumps(self.game_state)

    @classmethod
    def from_json(cls, game_id: str, players: List[Dict], json_str: str) -> 'LudoGame':
        """Create a LudoGame instance from JSON string"""
        game = cls(game_id, players)
        game.game_state = json.loads(json_str)
        return game 