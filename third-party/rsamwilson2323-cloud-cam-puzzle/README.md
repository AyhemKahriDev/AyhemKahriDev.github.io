# 🧩 PuzzleCam — Gesture Capture

**PuzzleCam — Gesture Capture** is an interactive **hand-gesture controlled photobooth puzzle game** that runs directly in the browser using **JavaScript, HTML, CSS, MediaPipe, Canvas, Web Audio API, and MediaRecorder**.

Instead of using a traditional camera button or keyboard controls, the player uses their **hands and pinch gestures** to capture a photo, solve a **3×3 puzzle**, and save the completed result as a **polaroid-style photograph**.

The project runs entirely in the browser with **no backend, no React, no npm, and no build process**.

---

# ✨ Features

📷 **Live Webcam Capture**

* Uses the computer's webcam through the browser.

* Displays the camera feed in real time.

* Camera access is requested through the browser's permission system.

---

🖐️ **Real-Time Hand Tracking**

* Uses **MediaPipe Tasks Vision HandLandmarker** to detect hands.

* Supports up to **two hands** simultaneously.

* Tracks important hand landmarks including:

```text
Wrist
Thumb
Index Finger
Middle Finger
Ring Finger
Pinky
```

* Supports GPU processing with CPU fallback.

---

🤏 **Pinch-to-Capture**

* The player raises both hands in front of the camera.

* The space between the two index fingertips becomes the photo frame.

* Pinching with both hands locks the frame.

* A **3-second countdown** begins automatically.

```text
Both Hands
     ↓
Index Fingers
     ↓
Create Photo Frame
     ↓
Pinch Both Hands
     ↓
3... 2... 1...
     ↓
📸 Capture
```

---

📸 **Photobooth Photo Effect**

The captured image is processed with a photobooth-style effect.

The project applies:

* Contrast adjustment
* Brightness adjustment
* Film-like noise
* Vignette effect
* Camera flash

The captured image is converted into two versions:

```text
Captured Image
      │
      ├── Full Color
      │      ↓
      │   Saved Photo
      │
      └── Black & White
             ↓
          Puzzle
```

---

🧩 **Automatic 3×3 Puzzle Creation**

After capturing the photo, the selected region is automatically divided into **9 puzzle pieces**.

```text
+---------+---------+---------+
|    1    |    2    |    3    |
+---------+---------+---------+
|    4    |    5    |    6    |
+---------+---------+---------+
|    7    |    8    |    9    |
+---------+---------+---------+
```

The puzzle uses the captured **black-and-white image** while the player is solving it.

---

🔀 **Automatic Puzzle Shuffle**

The nine pieces are randomly shuffled before the puzzle starts.

Every captured photo can therefore create a different puzzle arrangement.

---

🤏 **Gesture-Based Puzzle Movement**

Puzzle pieces can be controlled using a **pinch gesture**.

```text
Pinch
  ↓
Select Piece
  ↓
Drag Piece
  ↓
Move to Correct Position
  ↓
Release
  ↓
Piece Snaps Into Place
```

Pieces automatically snap into their correct position when they are close enough.

---

🎯 **Puzzle Completion Detection**

The application continuously checks whether all nine puzzle pieces are in their correct positions.

The progress indicator displays:

```text
0 / 9 pieces placed
```

and updates as pieces are correctly positioned.

When the puzzle is complete:

```text
================================
       PUZZLE COMPLETE!
================================

      MAKE A FIST TO SAVE
```

---

✊ **Fist-to-Save**

After solving the puzzle, the player holds a **closed fist**.

The completed puzzle then:

* Triggers a shatter animation
* Plays a sound effect
* Saves the full-color photograph
* Adds the photograph to the gallery
* Resets the puzzle for the next round

This allows the player to create another photo without restarting the application.

---

💥 **Puzzle Shatter Animation**

When a puzzle is completed and saved, the puzzle visually breaks apart using a shatter effect.

```text
Solved Puzzle
      ↓
   ✊ Fist
      ↓
   💥 Shatter
      ↓
Color Photo
      ↓
Save to Strip
```

---

🖼️ **Polaroid Photo Gallery**

Every completed puzzle is saved into the gallery on the right side of the application.

Each saved photo receives:

* White polaroid-style border
* Date
* Photo number

Example:

```text
┌────────────────────┐
│                    │
│      PHOTO         │
│                    │
│                    │
│     05.09.2026     │
│        #01         │
└────────────────────┘
```

---

📸 **Three-Photo Strip**

The application supports a maximum of **3 completed photos** in one strip.

```text
PHOTO #1
   ↓
PHOTO #2
   ↓
PHOTO #3
   ↓
COMPLETE PHOTO STRIP
```

After completing the third puzzle, the application automatically displays the complete photo strip.

---

⬇️ **Download Photo Strip**

The completed photo strip can be downloaded as a **PNG image**.

The strip contains all saved polaroid photos arranged vertically.

Example filename:

```text
puzzlecam_strip_XXXXXXXX.png
```

---

🎥 **Automatic Video Recording**

The application records the puzzle-solving session using the browser's **MediaRecorder API**.

The recording is captured from the application's canvas.

The video can be downloaded as:

```text
WebM
```

Example filename:

```text
puzzlecam_solve_XXXXXXXX.webm
```

---

🔊 **Sound Effects**

The project generates sounds directly using the **Web Audio API**.

No external audio files are required.

Sound effects include:

```text
Countdown Beep
      ↓
Piece Snap
      ↓
Puzzle Shatter
      ↓
Completion Chime
      ↓
Photo Saved
```

---

# 📂 Project Structure

```text
cam_puzzle
│
├── css/
│   └── styles.css
│
├── app.js
├── guide.html
├── index.html
├── run.bat
├── README.md
└── LICENSE
```

---

# 📄 Important Files

## `index.html`

The main HTML page of the application.

It contains:

* Webcam element
* Main canvas
* Status display
* Puzzle progress indicator
* Recording indicator
* Gallery
* Download buttons
* Reset button
* Photo-strip modal

The application loads `app.js` as an ES module.

---

## `app.js`

The main JavaScript application.

It handles:

* MediaPipe initialization
* Webcam access
* Hand tracking
* Hand landmarks
* Pinch detection
* Fist detection
* Photo-frame calculation
* Countdown
* Image capture
* Image processing
* Puzzle generation
* Puzzle shuffling
* Gesture-based dragging
* Puzzle completion
* Shatter animation
* Gallery management
* Photo-strip generation
* PNG download
* Video recording
* WebM download
* Sound effects

The application uses **MediaPipe Tasks Vision v0.10.14** through a CDN.

---

## `styles.css`

Contains the visual design of the application.

It controls:

* Dark camera interface
* Yellow status elements
* Gallery sidebar
* Buttons
* Progress indicator
* Recording indicator
* Flash effect
* Photo-strip modal
* Animations
* Responsive layout

---

## `guide.html`

A separate visual guide page explaining:

* What PuzzleCam is
* How to run it
* Gesture controls
* Features
* Browser support
* Project information

---

## `run.bat`

Windows batch file used to start the project locally.

It can start a local Python HTTP server and open the application in the browser.

---

## `LICENSE`

Contains the project's license information.

---

# ⚙️ Installation

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/rsamwilson2323-cloud/cam_puzzle.git
cd cam_puzzle
```

---

# 🌐 2️⃣ Open the Project

Open the project folder in **Visual Studio Code**.

The project is a browser application, so it should be served through a local HTTP server rather than simply opening the HTML file directly.

---

# 🚀 3️⃣ Run the Project

### Option 1 — Run the BAT file

Double-click:

```text
run.bat
```

The project can then be opened through the local server.

---

### Option 2 — VS Code Live Server

Install the **Live Server** extension in VS Code.

Then:

```text
Open index.html
      ↓
Right Click
      ↓
Open with Live Server
```

The browser will open the local application.

---

# 🌐 4️⃣ Open in Browser

Use:

```text
http://localhost:5500
```

Allow webcam access when the browser asks for permission.

---

# 🌍 Internet Requirement

The project uses MediaPipe resources from online CDNs.

On the first launch, the browser needs internet access to load the MediaPipe library, WASM runtime, and hand-landmark model.

The application uses:

```text
MediaPipe Tasks Vision v0.10.14
```

The hand model is approximately **10 MB**.

---

# 🖥️ Browser Support

| Browser | Support            |
| ------- | ------------------ |
| Chrome  | ⭐ Recommended      |
| Edge    | ⭐ Recommended      |
| Firefox | ✅ Works            |
| Safari  | ⚠️ Limited         |
| Mobile  | ⚠️ Not recommended |

For the best experience, use **Chrome or Microsoft Edge on a desktop/laptop with a webcam**.

---

# ▶️ Usage

## 🎮 Basic Game Flow

```text
Start Application
       ↓
Allow Camera
       ↓
Load MediaPipe
       ↓
Raise Both Hands
       ↓
Create Photo Frame
       ↓
Pinch Both Hands
       ↓
3 Second Countdown
       ↓
📸 Capture Photo
       ↓
Create 3×3 Puzzle
       ↓
Shuffle Pieces
       ↓
Pinch & Drag Pieces
       ↓
Place All 9 Pieces
       ↓
Puzzle Complete
       ↓
✊ Hold Fist
       ↓
💥 Puzzle Shatters
       ↓
Save Color Photo
       ↓
Photo Added to Strip
       ↓
New Puzzle
```

---

# 🖐️ Gesture Controls

| Gesture              | Action                                   |
| -------------------- | ---------------------------------------- |
| 🖐️ Raise both hands | Start hand tracking / define photo frame |
| 🤏 Pinch both hands  | Capture the selected photo area          |
| 🤏 One-hand pinch    | Select and drag a puzzle piece           |
| Release pinch        | Drop the puzzle piece                    |
| ✊ Closed fist        | Save completed puzzle                    |
| 🔄 Reset button      | Reset the entire photo strip             |

---

# 📸 How to Capture a Photo

1. Stand in front of the webcam.

2. Raise both hands.

3. Position your index fingertips to define the photo frame.

4. Pinch with both hands.

5. A countdown begins:

```text
3
2
1
```

6. The camera flashes.

7. The selected region is captured.

8. The captured image becomes a 3×3 puzzle.

---

# 🧩 How to Solve the Puzzle

After the photo is captured, the image becomes black and white.

Use one hand to:

```text
Pinch Piece
     ↓
Drag Piece
     ↓
Move to Correct Position
     ↓
Release
```

When a piece is close enough to its correct location, it automatically snaps into place.

The progress display shows:

```text
1 / 9 pieces placed
2 / 9 pieces placed
3 / 9 pieces placed
...
9 / 9 pieces placed
```

---

# ✊ How to Save After Solving

Once all nine pieces are correctly positioned:

```text
PUZZLE COMPLETE!
```

Hold a **closed fist**.

The application will:

```text
Fist
 ↓
Shatter Animation
 ↓
Save Color Photo
 ↓
Add Photo to Strip
 ↓
Reset Puzzle
 ↓
Ready for New Photo
```

You **do not need to restart the application** after completing one puzzle.

Simply raise both hands again to start the next photo.

---

# 🖼️ How to Create a Full Photo Strip

The application allows **3 completed puzzles**.

```text
Puzzle 1
   ↓
Save Photo #1

Puzzle 2
   ↓
Save Photo #2

Puzzle 3
   ↓
Save Photo #3

      ↓

YOUR PHOTO STRIP
```

After the third photo is saved, the photo-strip popup automatically appears.

---

# ⬇️ How to Download the Photo Strip

After completing 3 puzzles:

```text
YOUR PHOTO STRIP
```

appears on the screen.

Click:

```text
Download
```

or use:

```text
download strip
```

from the right-side gallery.

The strip is downloaded as:

```text
PNG
```

Example:

```text
puzzlecam_strip_XXXXXXXX.png
```

---

# 🎥 How to Download the Solve Video

The application automatically records the puzzle-solving session.

After the recording is finished, the button:

```text
download video
```

becomes available.

Click it to download the recording.

The video format is:

```text
WebM
```

Example:

```text
puzzlecam_solve_XXXXXXXX.webm
```

---

# 🔄 How to Start a New Puzzle

After saving one puzzle:

```text
Completed Puzzle
      ↓
✊ Fist
      ↓
Photo Saved
      ↓
Puzzle Resets
      ↓
Raise Both Hands
      ↓
Capture New Photo
```

You can continue until **3 photos** have been added to the strip.

---

# 🗑️ How to Reset Everything

Use the:

```text
RESET ALL
```

button in the gallery.

This clears:

* Saved photos
* Photo strip
* Puzzle state
* Current recording state
* Progress

The application then returns to the initial tracking state.

---

# 🧠 How It Works

## 1️⃣ Webcam

The browser requests access to the user's webcam.

The camera stream is used as the source for the live visual processing.

---

## 2️⃣ MediaPipe Hand Tracking

The application initializes:

```text
MediaPipe Tasks Vision
        ↓
HandLandmarker
        ↓
Up to 2 Hands
        ↓
21 Landmarks per Hand
```

Important landmarks include:

```text
0  → Wrist
4  → Thumb Tip
8  → Index Tip
12 → Middle Tip
16 → Ring Tip
20 → Pinky Tip
```

---

## 3️⃣ Pinch Detection

The program calculates the distance between:

```text
Thumb Tip
     +
Index Tip
```

When the distance falls below the configured threshold, the hand is considered to be pinching.

Conceptually:

```text
Distance < Threshold
        ↓
      PINCH
```

---

## 4️⃣ Photo Frame Detection

The two index fingertips are used to determine the selected camera frame.

The application calculates:

```text
Left
Right
Top
Bottom
Width
Height
```

This creates the region that will become the puzzle image.

---

## 5️⃣ Photo Processing

After capture, the selected region is processed.

The application creates:

### Color Version

Used for the final saved photo.

```text
Original
   ↓
Contrast
   ↓
Brightness
   ↓
Noise
   ↓
Vignette
   ↓
Color Photo
```

### Black & White Version

Used while solving the puzzle.

```text
Original
   ↓
Grayscale
   ↓
Contrast
   ↓
Brightness
   ↓
Noise
   ↓
Vignette
   ↓
Puzzle Image
```

---

# 🧩 6️⃣ Puzzle Generation

The captured image is divided into:

```text
3 × 3 = 9 Pieces
```

Each piece stores its original:

```text
Row
Column
Position
```

The pieces are then shuffled.

---

# 🎯 7️⃣ Snap Detection

When a puzzle piece is moved close enough to its original position, the application checks the distance between the current and correct positions.

If the piece is within the allowed snapping distance:

```text
Current Position
       ↓
Near Correct Position
       ↓
SNAP
       ↓
Correct Position
```

---

# 🏆 8️⃣ Completion Detection

The application checks all nine pieces.

When:

```text
Piece 1 → Correct
Piece 2 → Correct
Piece 3 → Correct
...
Piece 9 → Correct
```

the puzzle becomes solved.

The player must then make a fist to save it.

---

# 💥 9️⃣ Shatter Effect

The solved puzzle is divided into multiple fragments for the visual shatter animation.

```text
Solved Puzzle
      ↓
Split Into Fragments
      ↓
Physics Animation
      ↓
Fragments Move
      ↓
Color Photo Revealed
```

---

# 🖼️ 🔟 Gallery System

Each completed puzzle is stored in the application's gallery.

The gallery maintains up to:

```text
3 Photos
```

Each saved photo receives a polaroid-style presentation containing:

```text
Photo
Date
Photo Number
```

---

# 📦 Technologies Used

| Technology             | Purpose                              |
| ---------------------- | ------------------------------------ |
| 🌐 HTML5               | Application structure                |
| 🎨 CSS3                | Interface and animations             |
| 🟨 JavaScript          | Main application logic               |
| 🖐️ MediaPipe          | Hand landmark detection              |
| 🎨 Canvas 2D API       | Camera rendering and puzzle graphics |
| 🔊 Web Audio API       | Sound generation                     |
| 🎥 MediaRecorder API   | Puzzle video recording               |
| 📷 WebRTC getUserMedia | Webcam access                        |
| 📦 ES Modules          | JavaScript module loading            |

---

# ⭐ What Makes This Project Different?

### 🖐️ Hands Instead of Buttons

The main interaction is based on hand gestures.

---

### 📸 Photobooth Experience

The application combines:

```text
Camera
+
Gesture Recognition
+
Puzzle
+
Sound
+
Animation
+
Photo Strip
```

into one browser experience.

---

### 🖤 B&W → 🌈 Color Reveal

The puzzle is intentionally displayed in black and white.

After solving:

```text
B&W Puzzle
     ↓
Solve
     ↓
💥 Shatter
     ↓
Full Color Photo
```

---

### 📸 Polaroid Style

Completed photos are presented as polaroid-style prints with a date and photo number.

---

### 🎥 Built-In Recording

The puzzle-solving process can be recorded and downloaded without requiring additional recording software.

---

### 🔊 Generated Sound

The sound effects are created using browser audio APIs instead of external sound files.

---

### 🚫 No Framework

The project does not require:

```text
React
Vue
Angular
npm
Webpack
Vite
```

It uses browser technologies directly.

---

# 🚀 Future Improvements

🔊 More advanced sound effects

⏱️ Adjustable countdown timer

🏆 Score system

⏱️ Puzzle completion timer

🏅 Leaderboard

🧩 Multiple puzzle difficulties

```text
Easy
3 × 3

Medium
4 × 4

Hard
5 × 5
```

🖐️ More advanced gesture controls

👥 Multiplayer mode

📸 Photo filters

🎨 Different photobooth themes

💾 Local photo history

📱 Better mobile support

🌐 Progressive Web App support

☁️ Optional cloud photo storage

---

# 🎯 Project Objective

The main objective of **PuzzleCam** is to combine **computer vision, gesture recognition, photography, and interactive gaming** into a single browser-based experience.

The project demonstrates how modern browser APIs and computer vision can be combined without a traditional backend or frontend framework.

```text
Webcam
   +
MediaPipe
   +
Hand Tracking
   +
Gesture Recognition
   +
Canvas
   +
Puzzle Logic
   +
Web Audio
   +
MediaRecorder
   ↓
🧩 PUZZLECAM
```

---

# ⚠️ Requirements & Limitations

* A working webcam is required.

* Camera permission must be granted.

* Good lighting improves hand tracking.

* Chrome or Edge is recommended.

* Internet access is required when loading MediaPipe resources for the first time.

* Mobile devices are not recommended for the best experience.

* Hand tracking performance depends on camera quality and system performance.

---

# 🛠️ Troubleshooting

## Camera is not working

Make sure:

```text
Camera Permission = Allowed
```

Also make sure another application is not exclusively using the webcam.

---

## Hands are not detected

Try:

* Improving room lighting
* Moving hands closer to the camera
* Keeping your hands inside the camera view
* Using Chrome or Edge

---

## MediaPipe does not load

Check your internet connection.

The application loads MediaPipe resources from online CDNs.

---

## `index.html` does not work when double-clicked

Run the project through a local web server.

Recommended:

```text
VS Code
   ↓
Live Server
   ↓
http://localhost:5500
```

or use:

```text
run.bat
```

---

# 👨‍💻 Author

**Sam Wilson**

🌐 GitHub

https://github.com/rsamwilson2323-cloud

💼 LinkedIn

https://www.linkedin.com/in/sam-wilson-14b554385

---

# 📜 License

This project is licensed under the **MIT License**.

---

# ⭐ Repository

**cam_puzzle**

https://github.com/rsamwilson2323-cloud/cam_puzzle

If you enjoy the project, consider giving the repository a ⭐ on GitHub.
