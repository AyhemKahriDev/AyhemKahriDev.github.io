import pygame
from pathlib import PurePath
from GameObjects.Sprite import Sprite
from GameModules.ColorPalette import ColorPalette


class GameOverMenu:
    """
    The game over screen
    """
    def __init__(self, canvas_dimensions):
        """
        Initializes a new instance of the GameOverMenu class \n
        :param canvas_dimensions: A width x height tuple representing the dimensions of the canvas wherein the
        menu is to be drawn
        """
        self.__color_palette = ColorPalette()
        self.frame_number = 0

        self.canvas_width, self.canvas_height = canvas_dimensions

        # Import resources
        self.__title_font = pygame.font.Font(str(PurePath("res/Fonts/04B_19.TTF")), 65)
        self.__highlight_font = pygame.font.Font(str(PurePath("res/Fonts/04B_19.TTF")), 70)
        self.__outline_font = pygame.font.Font(str(PurePath("res/Fonts/04B_19.TTF")), 75)
        self.__score_font = pygame.font.Font(str(PurePath("res/Fonts/04B_19.TTF")), 35)
        self.__prompt_font = pygame.font.Font(str(PurePath("res/Fonts/04B_19.TTF")), 30)

        # Initialize medals
        self.__bronze = Sprite(str(PurePath("res/Images/bronze.png")))
        self.__gold = Sprite(str(PurePath("res/Images/gold.png")))
        self.__platinum = Sprite(str(PurePath("res/Images/platinum.png")))

        self.scoreboard = Sprite(str(PurePath("res/Images/game_over_board.png")))

        # Initialize text surfaces
        self.medal_header_surface = self.__score_font.render("Medal", False, self.__color_palette.orange)

        self.game_title_surface = self.__title_font.render("Game", False, self.__color_palette.orange)
        self.game_highlight_surface = self.__highlight_font.render("Game", False, self.__color_palette.white_smoke)

        self.over_title_surface = self.__title_font.render("Over", False, self.__color_palette.orange)
        self.over_highlight_surface = self.__highlight_font.render("Over", False, self.__color_palette.white_smoke)

        # Initialize prompt text
        self.prompt_surface = self.__prompt_font.render("Press the Y key to play again", False,
                                                        self.__color_palette.dark_golden_rod)
        self.prompt_surface_shadow = self.__prompt_font.render("Press the Y key to play again", False,
                                                               self.__color_palette.white_smoke)

    def title_and_score_to_canvas(self, canvas, score):
        """
        Draws the screen onto the specified canvas
        :param canvas: The surface wherein the game over menu is to be drawn on
        :param score: The player's final score
        """
        self.__record_score(score)

        # Draw the "Game Over" text
        canvas.blit(self.game_highlight_surface, ((self.canvas_width // 5) - 5, 150))
        canvas.blit(self.over_highlight_surface, ((self.canvas_width // 2) + 15, 150))

        canvas.blit(self.game_title_surface, ((self.canvas_width // 5), 150))
        canvas.blit(self.over_title_surface, ((self.canvas_width // 2) + 20, 150))

        # scoreboard sprite parameters
        scoreboard_location = (self.canvas_height // 9, self.canvas_width // 2 - 50)
        scoreboard_dimensions = (410, 200)

        # medal sprite parameters
        medal_location = ((self.canvas_width // 4 - 15), self.canvas_height // 2 - 80)
        medal_dimensions = (80, 79)

        # Draw the scoreboard
        self.scoreboard.to_canvas(canvas=canvas, location=scoreboard_location, dimensions=scoreboard_dimensions)

        # Score text parameters
        best_score = str(self.__get_best_score())
        score_offset = self.compute_text_offset(str(score))
        high_score_offset = self.compute_text_offset(best_score)
        score_text_surface = self.__score_font.render(str(score), False, self.__color_palette.dark_orange)
        score_text_shadow_surface = self.__score_font.render(str(score), False, self.__color_palette.white_smoke)

        high_score_text_surface = self.__score_font.render(best_score, False, self.__color_palette.dark_orange)
        high_score_text_shadow_surface = self.__score_font.render(best_score, False, self.__color_palette.white_smoke)

        canvas.blit(score_text_shadow_surface, ((self.canvas_width // 2) + score_offset + 3,
                                                self.canvas_height // 2 - 90))
        canvas.blit(score_text_surface, ((self.canvas_width // 2) + score_offset, self.canvas_height // 2 - 90))

        canvas.blit(high_score_text_shadow_surface, ((self.canvas_width // 2) + high_score_offset + 3,
                                                     (self.canvas_height // 2) - 20))
        canvas.blit(high_score_text_surface, ((self.canvas_width // 2) + high_score_offset, (self.canvas_height // 2) - 20))

        # Draw the medal
        if (score >= 20) and (score <= 39):
            self.__bronze.to_canvas(canvas=canvas, location=medal_location, dimensions=medal_dimensions)
        elif (score >= 40) and (score <= 59):
            self.__gold.to_canvas(canvas=canvas, location=medal_location, dimensions=medal_dimensions)
        elif score >= 80:
            self.__platinum.to_canvas(canvas=canvas, location=medal_location, dimensions=medal_dimensions)

    def prompt_to_canvas(self, canvas):
        """
        Draws the instructions to the canvas
        :param canvas: The surface wherein the prompt text is to be drawn on
        """
        # Draw the prompt text
        canvas.blit(self.prompt_surface_shadow, ((self.canvas_width // 8) - 5, (self.canvas_height // 2) + 100))
        canvas.blit(self.prompt_surface, ((self.canvas_width // 8), (self.canvas_height // 2) + 100))

    def __record_score(self, score):
        """
        Writes the score to a simple text file \n
        :param score:The player's final score
        """
        if int(self.__get_best_score()) < score:
            with open('score.txt', 'w') as score_record:
                score_record.write(str(score))

    @staticmethod
    def compute_text_offset(score):
        """
        Determines the offset to be applied to the x-coordinate of the score text
        :param score: A value that represents a player's score
        """
        if len(score) == 1:
            return 135
        elif len(score) == 2:
            return 120
        elif len(score) == 3:
            return 105
        else:
            return 90

    @staticmethod
    def __get_best_score():
        """
        Retrieves the player's high score from the record
        :return: A string representing the player's highest score
        """
        try:
            with open('score.txt') as score_record:
                t_score = score_record.readlines()
            score = t_score[0].rstrip()
        except IOError:
            return "0"

        return score
