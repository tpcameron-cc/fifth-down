/* Fifth Down — the formation playbook.
 *
 * Every player sits in one square of the grid:
 *   col: -10 (left sideline) .. 10 (right sideline); 0 is the ball.
 *   row: defense  1 .. 9   (1 = on the line, 9 = deepest)
 *        offense -1 .. -6  (-1 = on the line, -6 = deepest)
 * "Right" (positive col) is the offense's right, treated as the strong / TE side.
 *
 * `role` decides what counts as a match: a guessed player lights up when the
 * answer has a player with the same role in the same square.
 * `label` is the position name shown once a player is lit.
 */
(function () {
  'use strict';

  const GRID = { minCol: -10, maxCol: 10, defRows: 9, offRows: 6 };

  const p = (role, label, col, row) => ({ role, label, col, row });

  // ---- Offense ----
  const OL = () => [p('OL', 'LT', -2, -1), p('OL', 'LG', -1, -1), p('OL', 'C', 0, -1), p('OL', 'RG', 1, -1), p('OL', 'RT', 2, -1)];
  const QB_UNDER = () => p('QB', 'QB', 0, -2);
  const QB_PISTOL = () => p('QB', 'QB', 0, -3);
  const QB_GUN = () => p('QB', 'QB', 0, -4);
  const WR = (col, row) => p('WR', 'WR', col, row);
  const TE = (col = 3, row = -1) => p('TE', 'TE', col, row);
  const RB = (col, row, label = 'RB') => p('RB', label, col, row);
  const FB = (col, row) => p('FB', 'FB', col, row);
  const off = (id, name, aliases, desc, players) =>
    ({ id, name, aliases, desc, side: 'offense', players: [...OL(), ...players] });

  // ---- Defense ----
  const DL4 = () => [p('DL', 'DE', -3, 1), p('DL', 'DT', -1, 1), p('DL', 'DT', 1, 1), p('DL', 'DE', 3, 1)];
  const DL3 = () => [p('DL', 'DE', -2, 1), p('DL', 'NT', 0, 1), p('DL', 'DE', 2, 1)];
  const CBS = () => [p('CB', 'CB', -9, 5), p('CB', 'CB', 9, 5)];
  const TWO_HIGH = () => [p('S', 'FS', -5, 7), p('S', 'SS', 5, 7)];
  const NICKEL = () => p('CB', 'NB', 6, 4);
  const LB = (col, row, label = 'LB') => p('LB', label, col, row);
  const def = (id, name, aliases, desc, players) =>
    ({ id, name, aliases, desc, side: 'defense', players });

  const FORMATIONS = [
    // ===================== OFFENSE =====================
    off('i_form', 'I-Formation', ['I Form', 'I', 'Pro I', 'I Formation'],
      'Fullback and tailback stacked directly behind a quarterback under center.',
      [QB_UNDER(), FB(0, -4), RB(0, -6, 'TB'), TE(), WR(-9, -1), WR(9, -2)]),

    off('strong_i', 'Strong I', ['I Strong', 'Offset I Strong', 'Strong I Formation'],
      'An I-Formation with the fullback offset toward the tight end side.',
      [QB_UNDER(), FB(1, -4), RB(0, -6, 'TB'), TE(), WR(-9, -1), WR(9, -2)]),

    off('weak_i', 'Weak I', ['I Weak', 'Offset I Weak', 'Weak I Formation'],
      'An I-Formation with the fullback offset away from the tight end.',
      [QB_UNDER(), FB(-1, -4), RB(0, -6, 'TB'), TE(), WR(-9, -1), WR(9, -2)]),

    off('pro_set', 'Pro Set', ['Split Backs', 'Split Back', 'Pro', 'Pro Formation'],
      'Two backs side by side behind the quarterback, with a tight end and two receivers.',
      [QB_UNDER(), RB(-2, -4, 'HB'), FB(2, -4), TE(), WR(-9, -1), WR(9, -2)]),

    off('wishbone', 'Wishbone', ['Bone', 'Wishbone T'],
      'A triple-option look: fullback right behind the QB, two halfbacks a step deeper.',
      [QB_UNDER(), FB(0, -3), RB(-2, -5, 'HB'), RB(2, -5, 'HB'), TE(), WR(-9, -1)]),

    off('wing_t', 'Wing-T', ['Wing T', 'Delaware Wing-T', 'Wing'],
      'A fullback, an offset halfback and a wingback just outside the tight end.',
      [QB_UNDER(), FB(0, -4), RB(-2, -4, 'HB'), RB(4, -2, 'WB'), TE(), WR(-9, -1)]),

    off('jumbo', 'Jumbo', ['Heavy', 'Goal Line Offense', 'Offensive Goal Line', 'Heavy Jumbo'],
      'No receivers at all: three tight ends and an I-backfield for short yardage.',
      [QB_UNDER(), FB(0, -4), RB(0, -6, 'TB'), TE(-3, -1), TE(3, -1), TE(4, -2)]),

    off('singleback', 'Singleback', ['Ace', 'Single Back', 'Single-Back', '12 Personnel', 'Ace Twin TE'],
      'One back deep, tight ends on both sides and two flankers off the line.',
      [QB_UNDER(), RB(0, -6), TE(-3, -1), TE(3, -1), WR(-9, -2), WR(9, -2)]),

    off('singleback_doubles', 'Singleback Doubles', ['Ace Doubles', 'Singleback 3 Wide', 'Singleback 3-Wide', 'Singleback 11'],
      'One back under center with a tight end and three receivers in a 2x2 look.',
      [QB_UNDER(), RB(0, -6), TE(), WR(-9, -1), WR(-6, -2), WR(9, -2)]),

    off('pistol', 'Pistol', ['Pistol Formation', 'Pistol Doubles'],
      'QB a few yards off the ball with the running back lined up directly behind.',
      [QB_PISTOL(), RB(0, -6), TE(), WR(-9, -1), WR(-6, -2), WR(9, -2)]),

    off('gun_doubles', 'Shotgun Doubles', ['Gun Doubles', 'Shotgun 11', 'Shotgun 2x2 TE'],
      'Shotgun with a back beside the QB, a tight end and three receivers split 2x2.',
      [QB_GUN(), RB(-1, -4), TE(), WR(-9, -1), WR(-6, -2), WR(9, -2)]),

    off('spread', 'Shotgun Spread', ['Spread', 'Gun Spread', '4 Wide', 'Four Wide', 'Shotgun 4 Wide', '10 Personnel'],
      'Four receivers balanced two on each side, one back next to the shotgun QB.',
      [QB_GUN(), RB(1, -4), WR(-9, -1), WR(-6, -2), WR(6, -2), WR(9, -1)]),

    off('trips', 'Shotgun Trips', ['Trips', 'Gun Trips', 'Trips Right', '3x1'],
      'Three receivers to one side and a single receiver backside, out of the shotgun.',
      [QB_GUN(), RB(-1, -4), WR(-9, -1), WR(5, -2), WR(7, -2), WR(9, -1)]),

    off('bunch', 'Shotgun Bunch', ['Bunch', 'Trips Bunch', 'Bunch Right'],
      'Three receivers packed into a tight triangle to create traffic for defenders.',
      [QB_GUN(), RB(-1, -4), WR(-9, -1), WR(5, -1), WR(4, -2), WR(6, -2)]),

    off('empty', 'Empty', ['Empty Backfield', 'Shotgun Empty', 'Gun Empty', 'Five Wide', '5 Wide'],
      'Nobody in the backfield but the quarterback: five receivers spread out.',
      [QB_GUN(), WR(-9, -1), WR(-6, -2), WR(5, -2), WR(7, -2), WR(9, -1)]),

    // ===================== DEFENSE =====================
    def('four_three', '4-3', ['4-3 Over', 'Over', '4-3 Base', 'Four Three'],
      'Four down linemen and three linebackers, with two corners and two deep safeties.',
      [...DL4(), LB(-3, 3, 'WLB'), LB(0, 3, 'MLB'), LB(3, 3, 'SLB'), ...CBS(), ...TWO_HIGH()]),

    def('four_three_under', '4-3 Under', ['Under', 'Under Front'],
      'The 4-3 line slid toward the weak side, with the Sam backer walked up on the line.',
      [p('DL', 'DE', -4, 1), p('DL', 'DT', -2, 1), p('DL', 'NT', 0, 1), p('DL', 'DE', 3, 1),
        LB(5, 1, 'SLB'), LB(-3, 3, 'WLB'), LB(0, 3, 'MLB'), ...CBS(), ...TWO_HIGH()]),

    def('three_four', '3-4', ['3-4 Base', 'Odd Front', 'Three Four'],
      'Three linemen with a nose tackle, two stand-up outside backers and two inside.',
      [...DL3(), LB(-4, 1, 'OLB'), LB(4, 1, 'OLB'), LB(-1, 3, 'ILB'), LB(1, 3, 'ILB'), ...CBS(), ...TWO_HIGH()]),

    def('five_two', '5-2', ['Okie', '5-2 Okie', 'Five Two'],
      'An old-school front: five linemen with their hands down and two linebackers.',
      [...DL3(), p('DL', 'DE', -4, 1), p('DL', 'DE', 4, 1), LB(-1, 3), LB(1, 3), ...CBS(), ...TWO_HIGH()]),

    def('nickel', 'Nickel', ['4-2-5', 'Nickel 4-2-5', 'Nickel Defense'],
      'A 4-3 that swaps a linebacker for a fifth defensive back covering the slot.',
      [...DL4(), LB(-1, 3), LB(1, 3), NICKEL(), ...CBS(), ...TWO_HIGH()]),

    def('dime', 'Dime', ['4-1-6', 'Dime 4-1-6', 'Dime Defense'],
      'Six defensive backs and a lone linebacker for obvious passing downs.',
      [...DL4(), LB(0, 3, 'MLB'), NICKEL(), p('CB', 'DB', -6, 4), ...CBS(), ...TWO_HIGH()]),

    def('two_four_five', '2-4-5', ['Nickel 2-4-5', '3-4 Nickel', 'Two Four Five'],
      'A 3-4 team\'s nickel: two interior linemen, two edge backers and a slot corner.',
      [p('DL', 'DT', -1, 1), p('DL', 'DT', 1, 1), LB(-3, 1, 'OLB'), LB(3, 1, 'OLB'),
        LB(-1, 3, 'ILB'), LB(1, 3, 'ILB'), NICKEL(), ...CBS(), ...TWO_HIGH()]),

    def('forty_six', '46', ['46 Defense', 'Bear', '46 Bear', '4-6', 'Forty Six'],
      'Linemen covering the center and both guards, two backers on the line and a safety in the box.',
      [p('DL', 'DE', -3, 1), p('DL', 'DT', -1, 1), p('DL', 'NT', 0, 1), p('DL', 'DT', 1, 1),
        LB(3, 1), LB(4, 1), LB(-1, 3, 'MLB'), p('S', 'SS', 2, 4), p('S', 'FS', 0, 8), ...CBS()]),

    def('four_four', '4-4', ['4-4 Split', 'Four Four', 'Eight Man Front'],
      'Eight defenders in the box and a single deep safety to stop the run.',
      [...DL4(), LB(-4, 3), LB(-1, 3), LB(1, 3), LB(4, 3), ...CBS(), p('S', 'FS', 0, 8)]),

    def('three_three_five', '3-3-5', ['3-3-5 Stack', 'Stack', '33 Stack', 'Three Three Five'],
      'Three linebackers stacked behind three linemen, plus a third safety roaming.',
      [...DL3(), LB(-2, 3), LB(0, 3, 'MLB'), LB(2, 3), ...CBS(), ...TWO_HIGH(), p('S', 'S', 4, 6)]),

    def('goal_line', 'Goal Line', ['6-3-2', 'Goal Line Defense', 'Goal Line D', 'Defensive Goal Line'],
      'Six linemen, three linebackers and two corners packed in tight. No safeties.',
      [p('DL', 'DE', -5, 1), p('DL', 'DT', -3, 1), p('DL', 'DT', -1, 1), p('DL', 'DT', 1, 1), p('DL', 'DT', 3, 1), p('DL', 'DE', 5, 1),
        LB(-3, 2), LB(0, 2, 'MLB'), LB(3, 2), p('CB', 'CB', -7, 2), p('CB', 'CB', 7, 2)]),

    def('prevent', 'Prevent', ['Quarter', '3-1-7', 'Prevent Defense'],
      'Seven defensive backs sitting deep to keep everything in front of them.',
      [...DL3(), LB(0, 4, 'MLB'), ...CBS(), NICKEL(), p('CB', 'DB', -6, 4),
        p('S', 'S', -6, 8), p('S', 'FS', 0, 9), p('S', 'S', 6, 8)]),
  ];

  const api = { FORMATIONS, GRID };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.FifthDownData = api;
})();
