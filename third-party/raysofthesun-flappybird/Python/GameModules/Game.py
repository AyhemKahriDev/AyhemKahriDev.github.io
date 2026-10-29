import pygame
from pathlib import PurePath
from GameModules.MainMenu import Menu
from GameObjects.Bird import Bird
from GameObjects.PipeSet import PipeSet
from WorldObjects.Ground import Ground
from WorldObjects.Backdrop import Backdrop
from WorldObjects.Scoreboard import Scoreboard
from GameModules.GameOverMenu import GameOverMenu
from GameModules.ColorPalette import ColorPalette


class Game:
    def __init__(self):
        """
        Initializes a new instance of the Game class
        """
        self.colorPalette = ColorPalette()
        self.frame_number = 0

        # initialization of Pygame components
        pygame.init()
        self.__icon = self.__make_icon()
        self.screen_size = (600, 800)  # width x height
        self.canvas = pygame.display.set_mode(self.screen_size, 0, 32)
        pygame.display.set_caption("Flappy Bird")
        pygame.display.set_icon(self.__icon)
        self.clock = pygame.time.Clock()

        # Initialization of game models
        self.ground = Ground(self.screen_size)
        self.background = Backdrop(self.ground.offset)
        self.bird = Bird(ground_offset=self.ground.offset, y_coord=self.screen_size[1] // 2)
        self.pipes = [PipeSet()]
        self.menu_pipes = [PipeSet()]

        self.main_menu_screen = Menu(canvas_dimensions=self.screen_size)

        self.player_points = 0
        self.scoreboard = Scoreboard(canvas_dimensions=self.screen_size)
        self.game_over_screen = GameOverMenu(canvas_dimensions=self.screen_size)

        # Game control flow manipulation variables
        self.__play_game = False
        self.__just_launched = True
        self.player_dead = False
        self.scroll_speed = 2

    @staticmethod
    def __make_icon():
        """
        Constructs the surface for the window's icon
        """
        icon = pygame.image.load(str(PurePath("res/Images/bird_wing_down.png")))
        return icon

    def clean_canvas(self):
        """
        Removes everything that is drawn on the canvas or surface
        """
        self.canvas.fill(self.colorPalette.black)
        self.background.to_canvas(canvas=self.canvas)

    def play(self):
        """
        Run the game
        """
        self.show_main_menu()
        self.reset_components()

        while self.__play_game and not self.player_dead:
            # Set the frame rate to 60 frames per second (FPS)
            # skipping this would make the thing unplayable lol
            self.clock.tick(60)

            self.frame_number += 1

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.__play_game = False
                elif (event.type == pygame.KEYDOWN) or (event.type == pygame.MOUSEBUTTONDOWN):
                    self.bird.jump()

            self.make_pipes(self.pipes)
            for pipe_set in self.pipes:
                pipe_set.to_canvas(canvas=self.canvas)
                pipe_set.scroll(scroll_speed=self.scroll_speed)

            # In case the current pipe (pipe in front of the bird) goes off-screen (i.e. x-coordinate <= 0),
            # remove the PipeSet (pipe) object from the PipeSet collection so the collection won't grow too much
            if self.pipes[0].x_coordinate <= 0:
                self.pipes.pop(0)

            # Only check if the bird will collide with the pipe that is in front of it
            if self.pipes[0].collide(bird=self.bird):
                self.bird.hit_sound.play()
                self.player_dead = True
                self.bird.is_dead = True
            elif self.pipes[0].is_cleared(bird=self.bird):
                self.player_points += 1
                self.scoreboard.buzz()

            self.bird.to_canvas(canvas=self.canvas)

            self.ground.to_canvas(canvas=self.canvas)

            self.scoreboard.to_canvas(canvas=self.canvas, score=str(self.player_points))

            # Update the canvas so what we've drawn will be seen
            pygame.display.flip()

            # erase everything in the canvas before redrawing so new stuff won't overlap with old stuff
            self.clean_canvas()

            if self.player_dead:
                self.let_bird_fall()
                self.show_game_over_screen()
                self.reset_components()

            print(f"FPS: {self.clock.get_fps()}")

        pygame.quit()

    def reset_components(self):
        """
        Cleans up anything generated and modified by the menu module of the game
        """
        self.menu_pipes = [PipeSet()]
        self.pipes = [PipeSet()]
        self.frame_number = 0  # Reset this one as it's also used by the actual game loop
        self.player_points = 0

    def make_pipes(self, pipe_set):
        """
        Creates a new PipeSet object that will serve as an obstacle in the game
        """
        # Every 60 frames, we draw a new pipe
        if self.frame_number % 60 == 0:
            pipe_set.append(PipeSet())
            self.frame_number = 0  # The frame counter is reset to prevent it from becoming too large

    def let_bird_fall(self):
        """
        Lets the bird plunge into oblivion
        """
        self.bird.death_sound.play()
        while (self.bird.y_coordinate != self.bird.lower_limit) or (self.frame_number % 20 != 0):
            self.clock.tick(60)
            self.frame_number += 1

            for pipe_set in self.pipes:
                pipe_set.to_canvas(canvas=self.canvas)

            self.bird.to_canvas(canvas=self.canvas)
            self.ground.to_canvas(canvas=self.canvas)

            pygame.display.flip()
            self.clean_canvas()

    def show_main_menu(self):
        """
        Draws the main menu text onto the canvas
        :return:
        """
        while not self.__play_game and self.__just_launched:
            self.clock.tick(60)
            self.frame_number += 1
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.__just_launched = False
                elif (event.type == pygame.KEYDOWN) or (event.type == pygame.MOUSEBUTTONDOWN):
                    self.__play_game = True
                    break

            self.background.to_canvas(canvas=self.canvas)

            self.make_pipes(self.menu_pipes)
            for pipe_set in self.menu_pipes:
                pipe_set.to_canvas(canvas=self.canvas)
                pipe_set.scroll(scroll_speed=2)

            # In case the current pipe (pipe in front of the bird) goes off-screen (i.e. x-coordinate <= 0),
            # remove the PipeSet (pipe) object from the PipeSet collection so the collection won't grow too much
            if self.menu_pipes[0].x_coordinate <= self.pipes[0].pipe_width:
                self.menu_pipes.pop(0)

            self.ground.to_canvas(canvas=self.canvas)

            self.main_menu_screen.title_to_canvas(canvas=self.canvas)

            if self.frame_number <= 30:
                self.main_menu_screen.prompt_to_canvas(canvas=self.canvas)

            pygame.display.flip()

            print(f"FPS: {self.clock.get_fps()}")

    def show_game_over_screen(self):
        """
        Display the player's score in a separate screen
        """
        while self.player_dead:
            self.clock.tick(60)
            self.frame_number += 1

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.__play_game = False
                    self.player_dead = False
                elif (event.type == pygame.KEYDOWN) and (event.key == pygame.K_y):
                    self.bird.reset()
                    self.__play_game = True
                    self.player_dead = False

            self.background.to_canvas(canvas=self.canvas)

            self.make_pipes(self.pipes)
            for pipe_set in self.pipes:
                pipe_set.to_canvas(canvas=self.canvas)
                pipe_set.scroll(scroll_speed=2)

            # In case the current pipe (pipe in front of the bird) goes off-screen (i.e. x-coordinate <= 0),
            # remove the PipeSet (pipe) object from the PipeSet collection so the collection won't grow too much
            if self.pipes[0].x_coordinate <= self.pipes[0].pipe_width:
                self.pipes.pop(0)

            self.ground.to_canvas(canvas=self.canvas)

            self.game_over_screen.title_and_score_to_canvas(canvas=self.canvas, score=self.player_points)

            if self.frame_number <= 30:
                self.game_over_screen.prompt_to_canvas(canvas=self.canvas)

            pygame.display.flip()

            print(f"FPS: {self.clock.get_fps()}")




