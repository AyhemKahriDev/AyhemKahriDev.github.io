import pygame
from pathlib import PurePath
from GameModules.ColorPalette import ColorPalette
from GameObjects.Sprite import Sprite


class Bird:
    def __init__(self, ground_offset, y_coord, x_coord=60):
        """
        Initializes a new bird object
        :param y_coord: The position of the bird on the y-axis
        :param x_coord: The position of the bird on the x-axis
        :param ground_offset: The distance from the bottom of the canvas to the
        top of the ground in the game world
        """
        self.__x_coordinate = x_coord
        self.__y_coordinate = y_coord
        self.ground_offset = ground_offset

        # We need the height and width of the canvas for error handling purposes
        self.__canvas_width, self.canvas_height = pygame.display.get_surface().get_size()

        self.__bird_width = 30

        # These limits will ensure that the entirety of the bird is always visible
        self.__upper_limit = self.canvas_height // self.__bird_width
        self.__lower_limit = (self.canvas_height - self.__bird_width) - self.ground_offset

        # Sprite parameters
        self.__sprites = [Sprite(image_file=str(PurePath("res/Images/bird_wing_down.png"))),
                          Sprite(image_file=str(PurePath("res/Images/bird_wing_up.png")))]
        self.__sprite = self.__sprites[0]

        # Import sound effects
        self.__hit_sound = pygame.mixer.Sound(str(PurePath("res/sounds/sfx_hit.wav")))
        self.__flap_sound = pygame.mixer.Sound(str(PurePath("res/sounds/sfx_wing_flap.wav")))
        self.__death_sound = pygame.mixer.Sound(str(PurePath("res/sounds/sfx_die.wav")))

        self.__colorPalette = ColorPalette()

        self.__jumped = False
        self.is_dead = False

        self.__pull = -14  # application will result into negative velocity
        self.__gravity = 1  # the force the pulls the bird downward
        self.__velocity = -5  # dictates the speed and direction of the bird
        self.frame_counter = 0  # needed for the flapping animation

    @property
    def y_coordinate(self):
        return self.__y_coordinate

    @property
    def x_coordinate(self):
        return self.__x_coordinate

    @property
    def hit_sound(self):
        return self.__hit_sound

    @property
    def death_sound(self):
        return self.__death_sound

    @property
    def lower_limit(self):
        return self.__lower_limit

    def to_canvas(self, canvas: pygame.Surface):
        """
        Draws the bird onto the specified canvas or surface
        :param canvas: The surface wherein the bird is to be drawn on
        """
        if self.__jumped:
            self.__fly()
        else:
            self.__fall()

        self.__update_position()

        # Parameters for the bird's sprite
        bird_location = (self.x_coordinate, self.y_coordinate)

        # Draw the bird
        self.__sprite.to_canvas(canvas=canvas, location=bird_location)

    def __fall(self):
        """
        Pushes the bird downward
        """
        self.__sprite = self.__sprites[0]
        if self.__y_coordinate != self.__lower_limit:
            self.__velocity += self.__gravity
            self.__pull = -14

    def __fly(self):
        """
        Pushes the bird upward
        :return:
        """
        self.__flap_sound.play()
        if self.__y_coordinate > self.__upper_limit:
            self.__pull += 2
            self.__velocity += self.__pull

        self.__jumped = False

    def __update_position(self):
        """
        Updates the position of the bird and also restricts it to within the visible area of the canvas
        :return:
        """
        self.frame_counter += 1

        # enforce the limits so the bird will always be visible.
        # velocity is set to zero so the bird won't get 'stuck' when it hits the upper or lower boundaries of
        # the canvas.
        if self.__y_coordinate <= 1 and not self.__jumped:
            self.__y_coordinate = self.__upper_limit
            self.__velocity = 0
        elif self.__y_coordinate >= self.canvas_height - self.ground_offset:
            self.__y_coordinate = self.__lower_limit
            self.__velocity = 0
        else:
            # applies a push or pull force to the bird
            self.__y_coordinate += self.__velocity

        if (self.frame_counter % 60 <= 30) and (not self.is_dead):
            self.__sprite = self.__sprites[1]
        else:
            self.__sprite = self.__sprites[0]

    def jump(self):
        """
        Activate the bird object's flight mechanism
        :return:
        """
        self.__jumped = True

    def reset(self):
        """
        Puts the bird back to its initial location
        """
        self.__x_coordinate = 60
        self.__y_coordinate = self.canvas_height // 2
