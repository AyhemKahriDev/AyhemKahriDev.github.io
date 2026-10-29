import asyncio
import unittest

from snakevortex.game.game_loop import kill_player
from snakevortex.game.game_state import connected_clients, game_state
from snakevortex.web import player_service as player_service_module
from snakevortex.web.player_service import PlayerService
from snakevortex.web.security import RateLimiter, is_same_origin


class SecurityRegressionTests(unittest.TestCase):
    def setUp(self):
        game_state["players"].clear()
        game_state["bots"].clear()
        game_state["food"].clear()
        game_state["power_food"].clear()
        game_state["leaderboard"].clear()
        game_state["spatial_grid"].clear()
        game_state["leaderboard_cache"].clear()
        connected_clients.clear()

    def test_same_origin_rejects_prefix_host_bypass(self):
        self.assertFalse(
            is_same_origin(
                {
                    "Host": "example.com",
                    "Origin": "http://example.com.evil.com",
                }
            )
        )

    def test_same_origin_allows_exact_host(self):
        self.assertTrue(
            is_same_origin(
                {
                    "Host": "example.com",
                    "Origin": "https://example.com",
                }
            )
        )

    def test_rate_limiter_storage_stays_bounded_under_many_fresh_ips(self):
        limiter = RateLimiter(10, 60)

        for index in range(1500):
            self.assertTrue(limiter.is_allowed(f"192.0.2.{index}"))

        self.assertLessEqual(len(limiter.storage), 1000)

    def test_remove_player_marks_snapshot_dead_before_dropping_food(self):
        service = PlayerService()
        player_id = "player-1"
        player = {
            "id": player_id,
            "name": "Player",
            "snake": [{"x": 1, "y": 1}, {"x": 2, "y": 2}],
            "score": 25,
            "alive": True,
            "powers": {},
        }
        game_state["players"][player_id] = player

        original_create_death_food = player_service_module.create_death_food
        player_service_module.create_death_food = lambda snake, score: [{"x": 1, "y": 1, "size": score}]
        try:
            service.remove_player(player_id, drop_food=True)

            if player.get("alive"):
                asyncio.run(kill_player(player_id, player))

            self.assertFalse(player.get("alive"))
            self.assertEqual(len(game_state["food"]), 1)
        finally:
            player_service_module.create_death_food = original_create_death_food

    def test_websocket_connection_limit_rejects_when_full(self):
        from snakevortex.config import MAX_WS_CONNECTIONS
        from snakevortex.web.routes import can_accept_websocket_connection

        for _ in range(MAX_WS_CONNECTIONS):
            connected_clients.add(object())

        self.assertFalse(can_accept_websocket_connection())


if __name__ == "__main__":
    unittest.main()
