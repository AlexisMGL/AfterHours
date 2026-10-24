# Exit Lane

Exit Lane is the arcade's third game, available at `/rush-hour`. It is a single-player sliding-car puzzle with original artwork and music. The interface is in French. It runs entirely in the browser without an account, backend or external asset service.

## Rules and controls

The board has six rows and six columns. Horizontal cars move left and right; vertical cars move up and down. Cars cannot rotate, pass through one another or leave the board. The red target car is the exception: clear its row and move it through the exit on the right to finish the puzzle. A slide of any distance counts as one move, so careful positioning matters more than speed. There is no timer.

- Drag a car with the mouse or a finger. The movement follows its axis and stops at legal cells.
- Select a car and use the arrow keys along its axis. Cars are also focusable from the keyboard.
- Undo returns to the preceding position. Restart restores the level's original arrangement.
- A hint identifies the next move on a shortest route from the current position.
- Use the level browser to explore the three worlds, revisit a completed puzzle or choose a new challenge.
- All 15 levels are available from the start. Progress, the current arrangement and best move counts are saved locally in this browser.

| Key | Action |
| --- | --- |
| Tab / Enter | Focus / select a car or control |
| Arrow keys | Slide the selected car along its axis |
| Shift + arrow | Slide to the furthest available position in that direction |
| Z / Ctrl+Z | Undo |
| R | Restart the puzzle |
| H | Show a hint |

The hint can be followed manually or applied with **Jouer ce coup**. A completed level earns up to three stars: three for an optimal solution, two for a solution close to the minimum and one for finishing. Levels can be replayed to improve the saved result.

Each world contains five puzzles. The city introduces clearance and simple dependencies, the coast needs more rearrangement, and the night world introduces the longest chains of moves. Difficulty follows the minimum number of slides required, rather than the number of cars alone. Worlds also change the scenery and color palette.

## Solvability

Every board is authored as fixed vehicle definitions and starting coordinates. The pure TypeScript engine validates grid bounds, vehicle lengths, occupied cells, the target car and the exit row. Its breadth-first search explores legal vehicle slides and returns a shortest solution. Tests solve all 15 initial boards and replay every returned move through the same rules used by the interface. Hints solve the current position, so moving away from the initial plan does not invalidate the guidance.

Undo and restart allow experimentation without losing access to a solution. A legal move is reversible until the target exits; no puzzle relies on random generation or on a one-time animation event.

## Music and sound

Five original compositions form a rotating playlist: **Café au carrefour**, **La route des embruns**, **Bossa sous les palmiers**, **Les néons du soir** and **Dernier virage, au calme**. They use Web Audio synthesis, with distinct melodies, arrangements and instrument colors. Playback starts after a user gesture, following browser audio requirements. Music controls show the current track and let the player mute playback, adjust the volume from 0 to 100 and move to the next track. The playlist advances automatically without repeating the same track consecutively. Puzzle sound effects accompany interaction and success. Playback pauses when the page is hidden and resumes from the saved musical position; leaving the game disposes the audio resources.

No music files, samples, streaming service or external requests are required. Saved audio preferences belong to Exit Lane and do not change the two other games.

## Architecture

- `src/traffic/core.ts`: board validation, collision checks, legal slides, solved-state detection and breadth-first solving.
- `src/traffic/levels.ts`: three worlds and 15 solvable, increasingly difficult puzzles.
- `src/traffic/main.ts`: game flow, pointer and keyboard input, hints, history, level browser and saved progress.
- `src/traffic/art.ts`, `style.css`: original SVG cars, world scenery and responsive layout.
- `src/traffic/audio.ts`: original synthesized playlist and interaction sound effects.
- `src/traffic/preview.ts`: independent catalog illustration.

The route is lazy-loaded from `src/main.ts`. The catalog imports only the small preview illustration. Neither the catalog nor Exit Lane imports Phaser. Ordinary links return to the arcade and unload the game's input handlers and audio.

The rules and level data have no DOM dependencies, allowing deterministic validation in Vitest. Browser checks cover the complete interaction path and responsive layout. Run `npm run test:all` from the repository root to run the current checks and build.
