# Looter Shooter v.1

A first-person PVE looter built with Three.js. Low-poly stylized 3D graphics, enemy AI, loot drops, resource nodes, and a persistent inventory.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Netlify via GitHub

1. Push this folder to a GitHub repo
2. Connect the repo in Netlify
3. Build command: `npm run build`
4. Publish directory: `dist`

(netlify.toml is already configured — zero-config deploy)

## Controls

| Key | Action |
|-----|--------|
| W A S D | Move |
| Mouse | Look |
| Left Click | Shoot |
| Shift | Sprint |
| Space | Jump |
| E | Harvest crystal node |
| R | Reload |
| I | Open / close inventory |
| Esc | Pause |

## Enemy Types

- **Scavenger** — fast, low HP, drops metal scrap + occasional crystal
- **Brute** — slow, high HP, heavy hitter, drops more loot

## Loot Types

| Item | Source |
|------|--------|
| Crystal Shard | Brutes, Scavengers (rare), crystal nodes |
| Metal Scrap | Scavengers, Brutes |
| Med Pack | Enemy drops (rare) — auto-heals 25 HP |
| Ore Chunk | Crystal nodes (future) |

## Project Structure

```
src/
  Game.js              Main game loop + scene
  main.js              Entry point
  world/World.js       Terrain, trees, rocks, crystal nodes
  player/Player.js     Movement, health, inventory
  player/Controls.js   Keyboard + mouse input
  enemies/Enemy.js     Enemy AI state machine
  enemies/EnemyManager.js  Spawning + updates
  weapons/Weapon.js    Shooting, hit detection, effects
  loot/LootSystem.js   Drops, pickups, resource harvesting
  ui/HUD.js            HTML overlay
```

## Roadmap (v.2+)

- [ ] Base building (place + snap blocks)
- [ ] Crafting system
- [ ] More enemy types (ranged, elite)
- [ ] Supabase auth + save states
- [ ] Day/night cycle
- [ ] Minimap
