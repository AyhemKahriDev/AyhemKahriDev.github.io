import pygame
from pathlib import PurePath
from GameModules.ColorPalette import ColorPalette


class Menu:
    def __init__(self, canvas_dimensions):
        """
        Initializes a new instance of the Menu class
        :param canvas_dimensions: A width x height tuple representing the dimensions of the canvas wherein the
        menu is to be drawn
        """
        self.__color_palette = ColorPalette()
        self.frame_number = 0

        self.canvas_width, self.canvas_height = canvas_dimensions
        self.shadow_offset = 8

        # Import resources
        self.__title_font = pygame.font.Font(str(PurePath("res/Fonts/04B_19.TTF")), 70)
        self.__prompt_font = pygame.font.Font(str(PurePath("res/Fonts/04B_19.TTF")), 30)

        # Initialize title text
        self.title_surface = self.__title_font.render("Flappy Bird", False, self.__color_palette.medium_sea_green)
        self.title_surface_shadow = self.__title_font.render("Flappy Bird", False, self.__color_palette.white_smoke)

        # Initialize prompt text
        self.prompt_surface = self.__prompt_font.render("Press anything to play", False, self.__color_palette.dark_golden_rod)
        self.prompt_surface_shadow = self.__prompt_font.render("Press anything to play", False, self.__color_palette.white_smoke)

    def title_to_canvas(self, canvas):
        """
        Draws the menu to the specified canvas
        :param canvas: The surface wherein the title text is to be drawn on
        """
        # Draw the title text
        canvas.blit(self.title_surface_shadow, ((self.canvas_width // 5) + self.shadow_offset, self.canvas_width // 2))
        canvas.blit(self.title_surface, (self.canvas_width // 5, self.canvas_width // 2))

    def prompt_to_canvas(self, canvas):
        """
        Draws the instructions to the canvas
        :param canvas: The surface wherein the prompt text is to be drawn on
        """
        # Draw the prompt text
        canvas.blit(self.prompt_surface_shadow, ((self.canvas_width // 5) + 25, self.canvas_width // 2 + 80))
        canvas.blit(self.prompt_surface, ((self.canvas_width // 5) + 20, self.canvas_width // 2 + 80))


