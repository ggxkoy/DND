# Messenger Geometry Clone

A lightweight Three.js recreation of [messenger.abeto.co](https://messenger.abeto.co/) with simple geometry instead of original art assets.

## Reference

- Original website: [https://messenger.abeto.co/](https://messenger.abeto.co/)

## What it includes

- Full-screen title scene with `MES / SEN / GER` and `BEGIN`
- Tiny spherical world rendered in Three.js
- Third-person character movement on a small planet
- Desktop and mobile controls
- Quest HUD in the top-right corner
- NPC interaction and multi-step delivery quests
- Reset progress, outfit swap, and recenter camera actions

## Controls

- `WASD` or arrow keys: move
- `Shift`: sprint
- `Space`: jump
- `E`: talk to the nearest NPC

## Local development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Tech

- Node.js
- Express
- Three.js

## Project files

- `public/index.html`: UI shell
- `public/styles.css`: HUD and overlay styles
- `public/app.js`: world setup, player controls, camera, quests, and NPC logic
- `server.mjs`: static server and local Three.js module exposure

## Notes

- The project intentionally replaces original art with primitive geometry.
- Quest progress is stored in `localStorage`.
- The current build is a static local web app with no backend save service.
