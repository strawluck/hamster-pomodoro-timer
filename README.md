# Hamster Pomodoro Timer

A small pixel-art pomodoro timer that plays a green-screen hamster video when time's up. It's a single-page site with no frameworks or build step.

## What it does

- Set a countdown in minutes and seconds, or use a preset (5, 15, 25, or 45 minutes)
- Start, pause, resume, and reset the timer
- An original chiptune loop plays in the background while the timer runs, with a mute toggle
- When the timer hits zero, a canvas-based chroma key strips the green screen from a hamster video in real time and plays it with its own audio, alongside a bouncing "TIME'S UP!" caption
- The page sits on top of an animated pixel-art background gif, with a color theme picked to match it

## How it's built

Plain HTML, CSS, and JavaScript. No frameworks, no npm packages, no build step.

- `index.html`: page structure and markup
- `style.css`: layout, the pixel font (Press Start 2P, loaded from Google Fonts), and the color theme
- `script.js`: timer logic, the green-screen removal, and the music
- `assets/`: `background.gif` and `hamster.mov`

A few notes on how the pieces actually work:

- The countdown is a plain `setInterval` that ticks once a second and counts down a `remaining` variable.
- The background music is generated in code with the Web Audio API, not loaded from an audio file. Two oscillators, a square wave for the melody and a triangle wave for the bass, play a short pentatonic loop. Notes are scheduled ahead of time so the timing stays steady even if the tab is busy doing something else.
- The green-screen effect draws each video frame onto a hidden canvas, reads the pixel data, and makes sufficiently green pixels transparent, with a feathered edge so there's no hard cutout line around the hamster. That's what lets it appear to float over the timer card instead of sitting in a green box.
- The background is just an `<img>` tag with `object-fit: cover`. GIFs animate on their own once loaded, so no extra code is needed for that part.

## Running it locally

The chroma key reads pixel data off the video through canvas, and browsers block that kind of read on pages opened directly from disk (`file://`). So the page needs to be served over HTTP.

From the project folder, run:

```bash
python3 -m http.server 8765
```

Then open:

```
http://localhost:8765
```

Press Ctrl+C in that terminal to stop the server when you're done. Any static file server works the same way, so `npx serve` or VS Code's Live Server extension are fine too if you'd rather use one of those.

## Customizing

- Colors and the panel style live in the `:root` variables at the top of `style.css`.
- If the chroma key leaves a green fringe, or cuts too much off the hamster, adjust `GREEN_CUTOFF` and `FEATHER` near the top of `script.js`.
- The melody is the `MELODY` and `BASS` arrays in `script.js`, written as frequencies in Hz, with `null` standing in for a rest.
