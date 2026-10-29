from pathlib import PurePath
from GameObjects.Sprite import Sprite


class Backdrop:
    """
    The image underneath every other element in the game world
    """
    def __init__(self, ground_offset):
        """
        Initializes a new instance of the Backdrop class \n
        :param ground_offset: The offset value of the ground object in the canvas wherein
        the backdrop is to be drawn
        """
        self.offset = ground_offset
        self.sprite = Sprite(str(PurePath("res/Images/background.png")))
        self.location = (0, -self.offset)

    def to_canvas(self, canvas):
        """
        Draws the backdrop onto the specified canvas or surface \n
        :param canvas: The surface wherein the backdrop is to be drawn on
        """
        self.sprite.to_canvas(canvas=canvas, location=self.location)

