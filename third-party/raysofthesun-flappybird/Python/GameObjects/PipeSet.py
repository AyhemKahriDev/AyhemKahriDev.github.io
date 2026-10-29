import pygame, random
from pathlib import PurePath
from GameModules.ColorPalette import ColorPalette
from GameObjects.Sprite import Sprite


class PipeSet:
    """
    Represents an obstacle in the game
    """
    def __init__(self):
        """
        Initializes a new instance of the pipe class
        """
        self.canvas_height, self.canvas_width = pygame.display.get_surface().get_size()
        self.color_palette = ColorPalette()

        self.__x_coordinate = self.canvas_width
        self.__pipe_width = 60
        self.__passable_space_height = self.__pipe_width
        self.offset = self.__pipe_width // 2  # Divide the pipe's width then floor (//) the result

        # Sprites
        self.__pipe_head = Sprite(str(PurePath("res/Images/pipe_head.png")))
        self.__pipe_body = Sprite(str(PurePath("res/Images/pipe_body.png")))

        self.top_pipe_height = 0
        self.bottom_pipe_height = 0

        # Pipe parameters
        self.pipe_head_dimensions = (self.__pipe_width, self.offset)
        self.bottom_pipe_body_dimensions = None
        self.top_pipe_body_dimensions = None
        self.bottom_pipe_y_coordinate = None

        self.construct()

    @property
    def pipe_width(self):
        return self.__pipe_width

    @property
    def x_coordinate(self):
        return self.__x_coordinate

    def to_canvas(self, canvas):
        """
        Draws the bird onto the specified canvas or surface \n
        :param canvas: The surface wherein the pipe set is to be drawn on
        """

        pipe_x_coordinate = self.__x_coordinate - self.offset

        # Parameters for the top pipe
        top_pipe_body_location = (pipe_x_coordinate, -self.offset)
        top_pipe_head_location = (pipe_x_coordinate, (self.top_pipe_height - self.offset))

        # Parameters for the bottom pipe
        bottom_pipe_body_location = (pipe_x_coordinate, self.bottom_pipe_y_coordinate)
        bottom_pipe_head_location = (pipe_x_coordinate, self.bottom_pipe_y_coordinate)

        # Draw the top pipe
        self.__pipe_body.to_canvas(canvas=canvas, location=top_pipe_body_location,
                                   dimensions=self.top_pipe_body_dimensions)
        self.__pipe_head.to_canvas(canvas=canvas, location=top_pipe_head_location,
                                   dimensions=self.pipe_head_dimensions)

        # Draw the bottom pipe
        self.__pipe_body.to_canvas(canvas=canvas, location=bottom_pipe_body_location,
                                   dimensions=self.bottom_pipe_body_dimensions)
        self.__pipe_head.to_canvas(canvas=canvas, location=bottom_pipe_head_location,
                                   dimensions=self.pipe_head_dimensions)

    def construct(self):
        """
        Calculates the height and gap between the two pipes in the pipe set
        """
        max_height = abs((self.canvas_width // 2) - self.__passable_space_height * 4)
        self.bottom_pipe_height = random.choice(range(max_height, self.canvas_height))
        self.top_pipe_height = random.choice(range(self.__passable_space_height, max_height))

        self.bottom_pipe_body_dimensions = (self.__pipe_width, self.bottom_pipe_height * 4)
        self.top_pipe_body_dimensions = (self.__pipe_width, self.top_pipe_height)

        self.bottom_pipe_y_coordinate = self.bottom_pipe_height + self.offset

    def scroll(self, scroll_speed):
        """
        Gradually move the pipe towards the bird and off the screen
        """
        self.__x_coordinate -= scroll_speed

    def collide(self, bird):
        """
        Determines whether the bird had collided with either of the two pipes in the pipe set \n
        :param bird: The bird object that the player controls \n
        :return:True if the bird had collided with any of the pipes in the set
        """
        bird_in_contact = ((self.x_coordinate - self.pipe_width) - bird.x_coordinate) <= 0

        mid_point_y = ((self.top_pipe_height + self.bottom_pipe_height) // 2) - self.pipe_width
        if (bird_in_contact and (bird.y_coordinate <= self.top_pipe_height and bird.y_coordinate < mid_point_y)) or \
                (bird_in_contact and (bird.y_coordinate >= self.bottom_pipe_height and bird.y_coordinate > mid_point_y)):
            return True
        else:
            return False

    def is_cleared(self, bird):
        """
        Determines whether the bird has successfully passed through the pipe \n
        :return: True if the bird did not hit any of the pipes in the pipe set
        """
        mid_point_x = (self.__x_coordinate + bird.x_coordinate) // 2
        mid_point_y = (self.top_pipe_height + self.bottom_pipe_height) // 2
        is_in_between_pipes = ((bird.y_coordinate >= mid_point_y) or (bird.y_coordinate <= mid_point_y))

        # if the bird passes through the are in-between the two pipes, it has cleared the obstacle
        if bird.x_coordinate == mid_point_x and is_in_between_pipes:
            return True

        return False

    def reconstruct(self):
        self.__x_coordinate = self.canvas_width
        self.construct()
