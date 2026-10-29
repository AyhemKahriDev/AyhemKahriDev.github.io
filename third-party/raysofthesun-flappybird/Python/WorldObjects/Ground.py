from pathlib import PurePath
from GameObjects.Sprite import Sprite


class Ground:
    def __init__(self, canvas_dimensions):
        """
        Initializes a new instance of the Ground class \n
        :param canvas_dimensions: The width and height of the canvas
        """
        self.offset = 100
        self.canvas_width, self.canvas_height = canvas_dimensions
        self.location = (0, self.canvas_height - self.offset)
        self.dimensions = (self.canvas_height - self.offset, self.offset)
        self.sprite = Sprite(str(PurePath("res/Images/ground.png")))

    def to_canvas(self, canvas):
        """
        Draws the ground onto the specified canvas or surface \n
        :param canvas: The surface wherein the ground is to be drawn on
        """
        self.sprite.to_canvas(canvas=canvas, location=self.location, dimensions=self.dimensions)
