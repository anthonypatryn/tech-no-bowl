// The rules in our own words, for the Rules page, the in-game drawer and the "?" help on prompts.
// Techno mode (7-vs-7, no special abilities, no field goals). Page numbers point at the printed rulebook.
export const RULES = [
  { id: 'goal', title: 'The game', page: 3, items: [
    'Two halves. Score more than the other coach. Touchdown 7, safety 2 (no extra points, no punts, no kickoffs).',
    'You get four downs to score from wherever your drive starts. There are no first downs: score in four, or the ball goes over where the down ended.',
    'Every drive starts on your own 20 (after a score the other team starts on theirs; after a safety the team that scored gets the ball).',
  ] },
  { id: 'players', title: 'Players', page: 3, items: [
    'A player\'s skill rating is the first digit of his number (#6 is a 6, #55 is a 5). It runs 3 to 7.',
    'High numbers are fast and nimble; low numbers are strong. Move allowance = skill rating.',
    'Every player threatens the 8 squares around him (a knocked-down player threatens nothing).',
  ] },
  { id: 'formations', title: 'Lining up', page: 9, items: [
    'Offense first: the snapper goes on the spot. At least 3 on the line of scrimmage, with one line player within 2 squares on each side of the snapper.',
    'Nobody in the two squares diagonally behind the snapper. Someone must be straight behind him, within his skill rating, to take the snap.',
    'Any number of players on the line or the row right behind it; at most 4 in the backfield, all in the three lanes behind the snapper (the snap-taker counts).',
    'Defense: at least 3 on the line. The first three cover the snapper and two line players within 2 squares of him.',
    'A defender may stand on the line covering nobody only once every offensive line player is covered one-to-one. Uncovered offensive line players are fine otherwise.',
    'In the game: pick a set from the playbook, or click a player then a square. Green squares make the formation legal.',
  ] },
  { id: 'plays', title: 'Calling the play', page: 11, items: [
    'You have 2 cards per player. Pick 5 and stack them: that is the order your players go.',
    'Each round both coaches flip their top card. The higher skill rating decides who goes first (a tie: a die each; a tie again: the offense decides).',
    'Read and react: before deciding, the defense may swap its card for one off the bench; only then may the offense do the same. A swapped-in player can act, move his full allowance, or adjust, but not half-move and act.',
    'When the 5 are used, both coaches play one card at a time off the bench. When everyone has gone and the ball is still alive, all cards come back and you call 5 again.',
  ] },
  { id: 'motion', title: 'Motion', page: 11, items: [
    'After the calls: offense may put a player in motion, then the defense, then each gets a second chance.',
    'The first motion costs 1 bench card, the second 2. Only players off the line may move; stepping onto the line ends the motion. The formation must stay legal.',
  ] },
  { id: 'moving', title: 'Activations and moving', page: 4, items: [
    'When your player is up he can: move his full allowance, OR take one action, OR move up to half (rounded up) and then act. Or do nothing.',
    'Leaving a square costs 1. Leaving a square an opponent threatens costs 2 per opponent, 3 per opponent if you have the ball. Entering is free.',
    'Every other diagonal after the first costs 1 more. You can\'t pass through players or cut a diagonal between two players.',
    'A knocked-down player must stand first (costs 3).',
    'In the game: bright green squares = move and still act; teal = move only.',
  ] },
  { id: 'checks', title: 'Skill checks', page: 3, items: [
    'Roll 2 dice and add modifiers. 10+ total success; 7-9 success; 6 or less failure. Doubles make a success or failure critical.',
    'Total success: one of your other players gets a free full activation. Success: the other coach moves one player up to half. Failure: the action fails, your activation ends, and the other coach activates anyone.',
    'Rule of 3: bonuses stop at +3 and penalties at -3, then they net out.',
    'Teamwork: +1 for each teammate threatening the target, -1 for each opponent threatening the player acting.',
    'Bench boost: before rolling, discard that player\'s cards from your bench for +1 each (within the +3).',
  ] },
  { id: 'actions', title: 'Blocks, tackles, hand-offs', page: 6, items: [
    'Block / tackle: the lower-rated player gets the difference as a bonus, the higher-rated a penalty (max 3). You must be next to the target; a tackle needs the ball carrier.',
    'Block success: push him straight back or to either side of that square (you pick), then you may step into his square. Critical: he is also knocked down (and fumbles if he has the ball). No open square: knocked down where he stands.',
    'Block failure: he may turn it around on you. Critical failure: you go down (and may be pushed).',
    'Tackle success: down over at that spot. Critical: the ball comes loose and play goes on. Critical failure: the tackler goes down.',
    'Hand-off (part of a move): to or from a teammate next to you. Automatic unless either of you is threatened: then roll 2 dice, doubles = fumble.',
    'Defensive pressure: a defender stepping next to the ball carrier behind the line costs the offense 2 random bench cards, or a sack if they have fewer than 2.',
  ] },
  { id: 'passing', title: 'Passing', page: 7, items: [
    'Throw to a teammate or an open square, up to 2 x skill. +1 if the target is within your skill rating.',
    '-1 for every opponent threatening the target or the passer (max -3).',
    'To a teammate: caught. To open grass: the ball hangs over the square until someone moves in and catches it (2 dice, doubles = it gets away).',
    'Off target: it scatters. Once a forward pass is thrown or the ball crosses the line, only lateral or backward passes.',
  ] },
  { id: 'ball', title: 'Loose balls and scatter', page: 8, items: [
    'Each coach rolls a die: the difference is how far it goes, and the higher die picks the path.',
    'A fumble never goes out of bounds; a pass that does is incomplete. Equal dice: a dramatic recovery, the ball stays put.',
    'Picking up or catching a loose ball is part of a move: 2 dice, doubles = it gets away.',
    'If the defense comes up with the ball it is a turnover: they are on offense right away.',
  ] },
  { id: 'clock', title: 'The clock', page: 13, items: [
    'Each half has 6 one-minute cubes. Every play uses one; a running play (no pass, nobody out of bounds) uses a second.',
    'Each coach has 2 timeouts: a timeout adds one more play when the half is about to run out.',
    'Tied at the end: overtime, first score wins.',
  ] },
  { id: 'modes', title: 'Rule modes', page: 15, items: [
    'TECHNO: 7-vs-7, no abilities. ALL TECHNO: the same with every special ability on.',
    'PRO: 8-vs-8 (#51 plays) with field goals. ALL PRO: PRO plus the abilities. INFERNO: ALL TECHNO plus fire tokens.',
  ] },
  { id: 'skills', title: 'Special abilities', page: 15, items: [
    'Players with single-digit numbers, numbers ending in 0, or doubles (33, 44...) have abilities. Tap one on the team screen to read it.',
    'Abilities "as part of a move" (BLITZ, RUN BLOCK, DIVING TACKLE, JUKE, SHAKE) can each be used once per activation and he keeps moving afterwards.',
    'Only the last skill check of an activation decides the free activation (10+), the half move for them (7-9) or their free activation (6-).',
    'SPIN MOVE and STIFF ARM add a playmaker die to tackles on him: a match cancels that skill die.',
    'In a game, the ability buttons only appear when he can use them right now; his ability chips light up and his ring turns gold.',
  ] },
  { id: 'fieldgoals', title: 'Field goals', page: 20, items: [
    'PRO / ALL PRO only. Past the 50, instead of running a play you may kick.',
    'Distance = squares from the hiker\'s spot to just past the posts, +1. Roll 3 dice: that or more is good for 3, and the other team starts on its 20.',
    'Miss: the other team takes over where the kick was.',
  ] },
  { id: 'inferno', title: 'INFERNO', page: 19, items: [
    'Each coach holds up to 3 fire tokens. Earn one for: a tackle behind the line, a safety, grabbing a loose ball or interception, forcing a fumble, knocking a player down, an early celebration, or a dirty hit (3 on a critical).',
    'Showboating: add up to -3 to your own check; if it still works, take that many tokens.',
    'Spend: ON FIRE (3, before the snap): +3 on all his checks until he is tackled behind the line, knocked down, fumbles, runs out, fails a check or throws a pick.',
    'Also: +1 / -1 on any check per token, +1 movement per token, hurdle fallen players (1), EN FUEGO any skill (3), FIRE BOMB 3x throw range (3), BRING THE HEAT (3).',
    'Dirty hit: an action on a downed player, +1. Dogpile: a tackle\'s total success can be spent on a dirty hit after the whistle.',
  ] },
];

// which section explains a prompt
export const HELP_FOR = {
  formation: 'formations', call: 'plays', pick: 'plays', readReact: 'plays', first: 'plays', motion: 'motion', act: 'moving',
  boost: 'checks', bonus: 'checks', reverse: 'actions', push: 'actions', followUp: 'actions', adjustPartner: 'plays',
  scatter: 'ball', timeout: 'clock', toss: 'goal',
  kick: 'fieldgoals', dodge: 'skills', spin: 'skills', option: 'skills', onFire: 'inferno', fireDefend: 'inferno', heatCrit: 'inferno',
};
