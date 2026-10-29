import pygame
from pathlib import PurePath, Path
from GameModules.ColorPalette import ColorPalette


class Scoreboard:
    """
    Represents the in-game score counter
    """
    def __init__(self, canvas_dimensions):
        """
        Initializes a new instance of the Scoreboard class \n
        :param canvas_dimensions: A tuple containing the width and height of the canvas or surface where the
        scoreboard is to be drawn
        """
        # Effects
        self.__font = pygame.font.Font(str(PurePath("res/Fonts/04B_19.TTF")), 70)
        self.__sound = pygame.mixer.Sound(str(PurePath("res/sounds/sfx_point.wav")))

        self.__color_palette = ColorPalette()
        self.__canvas_width, self.canvas_height = canvas_dimensions

        # Text alignment parameters
        self.__score_length = 0
        self.__text_x_coordinate = self.__canvas_width // 2

    def to_canvas(self, canvas, score):
        """
        Draws the scoreboard onto the specified canvas or surface \n
        :param canvas: The surface wherein the bird is to be drawn on
        :param score: The numbers to be drawn onto the specified surface or canvas
        """
        # Make sure that the score text is always centered
        if len(score) > self.__score_length:
            self.__score_length = len(score)
            self.__text_x_coordinate -= 15

        # Draw the scoreboard's text
        score_surface = self.__font.render(score, False, self.__color_palette.white_smoke)
        score_surface_shadow = self.__font.render(score, False, self.__color_palette.black)
        canvas.blit(score_surface_shadow, (self.__text_x_coordinate, 55))
        canvas.blit(score_surface, (self.__text_x_coordinate, 50))

    def buzz(self):
        """
        Play a sound that indicates the player has earned a point
        """
        self.__sound.play()
