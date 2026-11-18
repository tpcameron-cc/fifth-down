# Fifth Down

A daily guessing game for football formations. A secret offensive or defensive
formation is hidden on a grid; you get five guesses to name it. Every guessed
player that lands in the same square as the same kind of player in the answer
lights up (O = offense, X = defense). Misses are shown faded.

## Run it

```
node serve.js
```

Then open http://localhost:5173. No install or build step.

## Files

- `formations.js`: the playbook. Each player is `{ role, label, col, row }` on the grid
  (`col` -10..10 with the ball at 0; `row` 1..9 for defense, -1..-6 for offense).
- `app.js`: game logic, daily puzzle selection, grid rendering, stats.
- `styles.css`, `index.html`: layout and look.
- `serve.js`: tiny static server for local play.

To add a formation, add an entry to `FORMATIONS` in `formations.js` with 11 players
in distinct squares. Players match when their `role` and square are the same.
