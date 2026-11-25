# TACTICAL STRIKE

Browser-based first-person tactical shooter foundation built with **Vite + Three.js**. This repository currently implements the first playable vertical slice for Parts 1–3: engine foundation, first-person player controller, collision-aware training range, procedural weapon prototypes, firing/reload/ammo/recoil/spread, hit detection, synthesized audio feedback, and HUD events.

> **Asset status:** weapon and hand meshes in this build are original procedural low-poly prototypes. They are not licensed scan-quality or AAA-ready character/weapon assets. Audio is synthesized through Web Audio; no external recordings are bundled. The build is a local training prototype, not a 5v5 networked competitive game.

## Published site and mobile mode

The repository root can run directly on GitHub Pages: `index.html` uses relative CSS paths and a browser import map for the pinned Three.js module. The normal Vite build remains available for development and production packaging. On touch devices, Pointer Lock is not requested; use the left virtual stick to move, drag on the right side of the screen to look, and use the right action buttons to fire, aim, jump, crouch, reload, and switch weapons.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+
- A current browser with WebGL 2 support. Pointer Lock is required only for desktop mouse control; touch devices use on-screen controls.

## Run

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). Click **НАЧАТЬ ТРЕНИРОВКУ**. On desktop, allow pointer lock; on phones and tablets, use the on-screen controls.

## Controls

| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Look |
| Shift | Sprint forward |
| Ctrl | Crouch |
| Space | Jump |
| Left mouse | Fire / melee |
| Right mouse | Aim |
| R | Reload |
| 1–0 | Select weapon |
| K / J / L | Select MAC-10 / Nova / XM1014 |
| Mouse wheel | Cycle quick slots |
| Q | Inspect prototype |
| F3 | Debug panel |
| Esc | Pause / release pointer lock |

## Build and checks

```bash
npm run check
npm run build
npm run preview
```

The Vite build uses relative asset paths (`base: './'`). The GitHub Pages branch deployment can also serve the source tree directly because `index.html` includes relative stylesheets and an import map. GitHub Actions verifies the source and production build on every push.

## Architecture

- `src/core/` — Game lifecycle, state machine, renderer, fixed-step loop, event bus, asset manager.
- `src/world/` — training range, materials, world collision AABBs and target hitboxes.
- `src/player/` — input manager, movement acceleration/friction, vertical physics, first-person camera and camera effects.
- `src/weapons/` — centralized weapon stats, prototype viewmodels, weapon state, recoil, spread, hitscan, impacts/tracers and Web Audio feedback.
- `src/interface/` — menu, pause screen, HUD, ammo, hit markers and debug overlay.

The simulation uses a fixed 120 Hz update step with a capped frame delta. Rendering is performed by one `requestAnimationFrame` loop and one `WebGLRenderer` instance.

## Implemented prototype weapon set

AK-47, M4A4, M4A1-S, AWP, SSG 08, Glock-18, USP-S, Desert Eagle, MP5-SD, MAC-10, Nova, XM1014, and combat knife have separate configuration entries and generated silhouettes. The current hands are shared procedural arm/hand geometry with segmented fingers; they are not skinned skeletal character assets, full finger IK, or motion-captured reload animations.

## Known scope limits

- No multiplayer/server authority, bots, round economy, bomb objective, armor, penetration, destructible materials, or match flow yet.
- No external high-detail GLB models, baked PBR texture sets, skeletal hand rig, authored weapon animations, or recorded weapon audio yet.
- Character collision uses a performant axis-separated AABB controller with a fixed-radius vertical body approximation; it is not a full capsule/rigid-body solver.
- Aim for scoped weapons currently narrows FOV and changes viewmodel placement; dedicated optical scope masking/reticles are not yet implemented.
- Browser automation / visual QA must still be performed in a real browser before treating this as release-ready.
