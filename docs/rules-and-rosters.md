# TECHNO BOWL - Team Guide / QRS / Rulebook (image pages) transcription

Sources viewed: Team Guide pp.1-17, QRS pp.1-4, Rulebook image pages 3, 4, 5, 9, 15, 16, 17, 18, 19, 20, 21 (3/4/5/9 viewed extra because they define skill rating, move allowance, threat zone, knocked down, sport check). All were legible at default render; no re-render needed (high-DPI crops exist in scratchpad/hi/ but were not required).

## 0. Core derivations (rulebook p.3, p.5, p.15)

- **Skill rating = first digit of the jersey number** (rulebook p.3: "The first digit on a player's uniform identifies the rating"; #51/55/58 -> 5; #6/64/66 -> 6). Range 3-7. Single-digit numbers: the digit itself (#4 -> 4, #5 -> 5, #6 -> 6, #7 -> 7). #40 -> 4, #60 -> 6, #70 -> 7.
- **Move allowance = skill rating** (rulebook p.5: "A player's move allowance is equal to his skill rating"). Half move = ceil(skill/2) (#7 -> 4, #5 -> 3).
- Higher numbers = faster/better at speed/agility/dexterity (and act first); lower numbers = slower but better at power/strength (block/tackle bonus to the LOWER rated player; juke/shake bonus to the HIGHER rated player).
- **Special player jersey numbers** (rulebook p.15): reserved numbers = single-digit numbers, double-digit numbers ending in zero (40, 60, 70), and double-digit numbers with the same digit (33, 44, 55, 66, 77). Every player with an ability in the guide uses one of these, EXCEPT the two INFERNO-only players (#73 Brent Spivey, #65 Eric 'No' Sack), who have no ability in normal play.
- **Tier** = count of extra abilities: 1 = impact, 2 = star, 3 = superstar. Shown in the guide by 1/2/3 colored squares before the name. "+N" skills count N abilities (Tackle +3 = 3 = superstar); an advanced skill with +N counts 1 + N (e.g., Juke +2 = superstar).
- **League skill cap**: a team may have at most 4 abilities in total; an individual max 3. All 32 teams (and the 3 alternate lineups) total exactly 4 - verified.
- **Roster**: 8 players listed per team, always including a #51. Base TECHNO/ALL TECHNO = 7-vs-7 (implied: #51 is removed); PRO and ALL PRO "add player #51 back onto the roster" -> 8-vs-8 (rulebook p.20).
- Skill names: the guide writes "SPIN"; the rulebook skill is "SPIN MOVE". I normalized to "SPIN MOVE" in the data.

## 1. Teams (32) + 3 alternate lineups

Schema per JSON block: `{team, players:[{num, name, skill, move, abilities:[], tier, inferno?}], alternate?:{note, replacements:[...]}}`. `skill` = first jersey digit, `move` = skill. Alternate-lineup replacement players replace the player(s) with the same role/slot as stated in the note (alternates swap "the impact/star/superstar and scouting cards").

**INFERNO-mode team specials (only when that player is ON FIRE!):**
- GORILLAS #73 Brent Spivey: "Anytime that Brent Spivey is 'On Fire!' in INFERNO Mode, he may choose to use any single skill when performing an activation or when he is the target of an action by a player on the opposing team. This may be a different skill each activation. If choosing a skill in response to being targeted by an action by a player on the opposing team, the skill must be declared before dice are rolled and the action is resolved."
- TRUCKS #65 Eric 'No' Sack: while 'On Fire!' in INFERNO Mode he gains the QB READ skill; QB Read is only in effect while he is On Fire.
- (Flavor only: YELLOW JACKETS #51 Sean 'El Fuego' Blanco - no rule.)

### ANKHS  (team guide p.2)
- Colors: Vegas-gold/cream helmet, ornate black/silver ankh logo, black facemask. Home: SUN GOD STADIUM. Cheer 'Who Ra?!'
- Notes: Mid-level both sides; Evan Jar uses blocking skill on both sides of the ball.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 44 | Evan Jar | 4 | 4 | impact | BLOCK +1 |
| 55 | Jack Richards | 5 | 5 | impact | BLITZ |
| 6 | Andrew Zephyr | 6 | 6 | impact | POCKET PASSER |
| 7 | Mack Two | 7 | 7 | impact | SPIN MOVE |
| 38 | Kyle Hilliard | 3 | 3 | normal | - |
| 43 | Gregory Sack | 4 | 4 | normal | - |
| 51 | Renaud Ungramme | 5 | 5 | normal | - |
| 65 | Burk Lockhart | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

ALTERNATE LINEUP: Alternate lineup swaps only the quarterback: #6 Andrew Zephyr (Pocket Passer) is replaced by #6 Jimmy 'Dr. Touchdown' Lockhart (QB Read). Impact marker (1 square).

```json
{"team": "ANKHS", "players": [{"num": 44, "name": "Evan Jar", "skill": 4, "move": 4, "abilities": ["BLOCK +1"], "tier": "impact"}, {"num": 55, "name": "Jack Richards", "skill": 5, "move": 5, "abilities": ["BLITZ"], "tier": "impact"}, {"num": 6, "name": "Andrew Zephyr", "skill": 6, "move": 6, "abilities": ["POCKET PASSER"], "tier": "impact"}, {"num": 7, "name": "Mack Two", "skill": 7, "move": 7, "abilities": ["SPIN MOVE"], "tier": "impact"}, {"num": 38, "name": "Kyle Hilliard", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 43, "name": "Gregory Sack", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Renaud Ungramme", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 65, "name": "Burk Lockhart", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}], "alternate": {"note": "Alternate lineup swaps only the quarterback: #6 Andrew Zephyr (Pocket Passer) is replaced by #6 Jimmy 'Dr. Touchdown' Lockhart (QB Read). Impact marker (1 square).", "replacements": [{"num": 6, "name": "Jimmy 'Dr. Touchdown' Lockhart", "skill": 6, "move": 6, "abilities": ["QB READ"], "tier": "impact"}]}}
```

### BANDITOS  (team guide p.2)
- Colors: Orange helmet, bandit-with-rifle 'BANDITOS' logo, black/dark-brown facemask.
- Notes: Two star players on opposite sides of the ball.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 44 | Santiago Marron | 4 | 4 | star | SHOVE, STIFF ARM |
| 55 | Max Clay | 5 | 5 | star | BLITZ, BLOCK +1 |
| 34 | Storm Nies | 3 | 3 | normal | - |
| 48 | Jaxon Rabatin | 4 | 4 | normal | - |
| 51 | Aiden Sinkko | 5 | 5 | normal | - |
| 61 | Rocco Rabatin | 6 | 6 | normal | - |
| 65 | Adam 'B' Blissett | 6 | 6 | normal | - |
| 72 | Kevin Rankin | 7 | 7 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "BANDITOS", "players": [{"num": 44, "name": "Santiago Marron", "skill": 4, "move": 4, "abilities": ["SHOVE", "STIFF ARM"], "tier": "star"}, {"num": 55, "name": "Max Clay", "skill": 5, "move": 5, "abilities": ["BLITZ", "BLOCK +1"], "tier": "star"}, {"num": 34, "name": "Storm Nies", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 48, "name": "Jaxon Rabatin", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Aiden Sinkko", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 61, "name": "Rocco Rabatin", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}, {"num": 65, "name": "Adam 'B' Blissett", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}, {"num": 72, "name": "Kevin Rankin", "skill": 7, "move": 7, "abilities": [], "tier": "normal"}]}
```

### BIG CATS  (team guide p.3)
- Colors: Purple/navy helmet with large yellow jaguar graphic, yellow facemask.
- Notes: Superstar RB Mark Fault, strong receiver out of backfield.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 6 | Curtis Warmer | 6 | 6 | impact | POCKET PASSER |
| 7 | Mark Fault | 7 | 7 | superstar | CATCH, SPIN MOVE, JUKE |
| 39 | Don Clevenger | 3 | 3 | normal | - |
| 46 | Joe Bagheera | 4 | 4 | normal | - |
| 47 | Jack Beckman | 4 | 4 | normal | - |
| 51 | Lina Cossette | 5 | 5 | normal | - |
| 59 | Skidd O'Shea | 5 | 5 | normal | - |
| 62 | Blake Spivey | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "BIG CATS", "players": [{"num": 6, "name": "Curtis Warmer", "skill": 6, "move": 6, "abilities": ["POCKET PASSER"], "tier": "impact"}, {"num": 7, "name": "Mark Fault", "skill": 7, "move": 7, "abilities": ["CATCH", "SPIN MOVE", "JUKE"], "tier": "superstar"}, {"num": 39, "name": "Don Clevenger", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 46, "name": "Joe Bagheera", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 47, "name": "Jack Beckman", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Lina Cossette", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 59, "name": "Skidd O'Shea", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 62, "name": "Blake Spivey", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

### BIGHORNS  (team guide p.3)
- Colors: Navy helmet, orange/white ram head logo, orange facemask.
- Notes: Balanced offense, four impact players. Phil Manly is brother of Gorillas' Elliot Manly (flavor).

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 33 | Tim Nailem | 3 | 3 | impact | TEAM PLAYER |
| 55 | Kerry Keen | 5 | 5 | impact | STIFF ARM |
| 6 | Phil Manly | 6 | 6 | impact | POCKET PASSER |
| 7 | Terry David | 7 | 7 | impact | JUKE |
| 42 | Chris Saguisag | 4 | 4 | normal | - |
| 45 | Leon Chan | 4 | 4 | normal | - |
| 51 | Matt 'Big Sexy' Sellers | 5 | 5 | normal | - |
| 68 | Cody Crowley | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "BIGHORNS", "players": [{"num": 33, "name": "Tim Nailem", "skill": 3, "move": 3, "abilities": ["TEAM PLAYER"], "tier": "impact"}, {"num": 55, "name": "Kerry Keen", "skill": 5, "move": 5, "abilities": ["STIFF ARM"], "tier": "impact"}, {"num": 6, "name": "Phil Manly", "skill": 6, "move": 6, "abilities": ["POCKET PASSER"], "tier": "impact"}, {"num": 7, "name": "Terry David", "skill": 7, "move": 7, "abilities": ["JUKE"], "tier": "impact"}, {"num": 42, "name": "Chris Saguisag", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 45, "name": "Leon Chan", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Matt 'Big Sexy' Sellers", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 68, "name": "Cody Crowley", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

### BULLS  (team guide p.4)
- Colors: White/silver helmet, navy bull head logo, navy facemask.
- Notes: Power rushing (Emmitt), pocket passing (Cakeman), lockdown defense/offense (Sandman).

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 55 | Sam Emmitt | 5 | 5 | star | STIFF ARM, RUN BLOCK |
| 6 | Roy Cakeman | 6 | 6 | impact | POCKET PASSER |
| 77 | Dee Sandman | 7 | 7 | impact | LOCKDOWN |
| 34 | Makis McGee | 3 | 3 | normal | - |
| 45 | Steven Massey | 4 | 4 | normal | - |
| 46 | Nitro McQueen | 4 | 4 | normal | - |
| 51 | Brian Griffin | 5 | 5 | normal | - |
| 65 | Raf Cordero | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "BULLS", "players": [{"num": 55, "name": "Sam Emmitt", "skill": 5, "move": 5, "abilities": ["STIFF ARM", "RUN BLOCK"], "tier": "star"}, {"num": 6, "name": "Roy Cakeman", "skill": 6, "move": 6, "abilities": ["POCKET PASSER"], "tier": "impact"}, {"num": 77, "name": "Dee Sandman", "skill": 7, "move": 7, "abilities": ["LOCKDOWN"], "tier": "impact"}, {"num": 34, "name": "Makis McGee", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 45, "name": "Steven Massey", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 46, "name": "Nitro McQueen", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Brian Griffin", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 65, "name": "Raf Cordero", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

### CHEFS  (team guide p.4)
- Colors: Red helmet, mustachioed chef logo, white facemask; red uniforms with yellow accents.
- Notes: 'Shake and Bake': Jamaal Child (Shake) and Tom Vincent (Bake).

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 55 | Tom Vincent | 5 | 5 | star | BLITZ, BLOCK +1 |
| 70 | Jamaal Child | 7 | 7 | star | CATCH, JUKE |
| 32 | Big Don Carr | 3 | 3 | normal | - |
| 42 | Ric 'Very Dangerous' Van Dyke | 4 | 4 | normal | - |
| 47 | Marc Vaughan | 4 | 4 | normal | - |
| 51 | Derrick 'Tank' Tindal | 5 | 5 | normal | - |
| 61 | Robert Boeck | 6 | 6 | normal | - |
| 69 | Brett Rabatin | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

ALTERNATE LINEUP: Alternate lineup: #55 Tom Vincent -> #55 Christian Okeydokay (superstar, 3 squares: Stiff Arm, Block +1, Run Block; 'The Tazmanian Terror'); #70 Jamaal Child -> #70 Deacon Homes (impact: Juke).

```json
{"team": "CHEFS", "players": [{"num": 55, "name": "Tom Vincent", "skill": 5, "move": 5, "abilities": ["BLITZ", "BLOCK +1"], "tier": "star"}, {"num": 70, "name": "Jamaal Child", "skill": 7, "move": 7, "abilities": ["CATCH", "JUKE"], "tier": "star"}, {"num": 32, "name": "Big Don Carr", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 42, "name": "Ric 'Very Dangerous' Van Dyke", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 47, "name": "Marc Vaughan", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Derrick 'Tank' Tindal", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 61, "name": "Robert Boeck", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}, {"num": 69, "name": "Brett Rabatin", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}], "alternate": {"note": "Alternate lineup: #55 Tom Vincent -> #55 Christian Okeydokay (superstar, 3 squares: Stiff Arm, Block +1, Run Block; 'The Tazmanian Terror'); #70 Jamaal Child -> #70 Deacon Homes (impact: Juke).", "replacements": [{"num": 55, "name": "Christian Okeydokay", "skill": 5, "move": 5, "abilities": ["STIFF ARM", "BLOCK +1", "RUN BLOCK"], "tier": "superstar"}, {"num": 70, "name": "Deacon Homes", "skill": 7, "move": 7, "abilities": ["JUKE"], "tier": "impact"}]}}
```

### ENGINES  (team guide p.5)
- Colors: Maroon/crimson helmet, tachometer 'E' logo, gold facemask.
- Notes: 'Red Line' rushing attack. Danforth (European import) is flavor only.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 33 | John Biggins | 3 | 3 | star | SHOVE, BLOCK +1 |
| 55 | Clint Portly | 5 | 5 | impact | RUN BLOCK |
| 6 | Bradley Fairbanks Danforth III | 6 | 6 | impact | ROUTE PASSER |
| 42 | Kirk Wood | 4 | 4 | normal | - |
| 43 | Andy Pymont | 4 | 4 | normal | - |
| 51 | Johnny 'Moto' Cross | 5 | 5 | normal | - |
| 62 | Brent 'Brawler' Oravits | 6 | 6 | normal | - |
| 72 | Manny Deckster | 7 | 7 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "ENGINES", "players": [{"num": 33, "name": "John Biggins", "skill": 3, "move": 3, "abilities": ["SHOVE", "BLOCK +1"], "tier": "star"}, {"num": 55, "name": "Clint Portly", "skill": 5, "move": 5, "abilities": ["RUN BLOCK"], "tier": "impact"}, {"num": 6, "name": "Bradley Fairbanks Danforth III", "skill": 6, "move": 6, "abilities": ["ROUTE PASSER"], "tier": "impact"}, {"num": 42, "name": "Kirk Wood", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 43, "name": "Andy Pymont", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Johnny 'Moto' Cross", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 62, "name": "Brent 'Brawler' Oravits", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}, {"num": 72, "name": "Manny Deckster", "skill": 7, "move": 7, "abilities": [], "tier": "normal"}]}
```

### FALCHIONS  (team guide p.5)
- Colors: Black helmet, white wings with red sword logo, black facemask with red clip.
- Notes: Superstar runner/sometimes passer Vic Mexico; rivalry with PIT BULLS (flavor).

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 66 | Juan Julio | 6 | 6 | impact | CATCH |
| 7 | Vic Mexico | 7 | 7 | superstar | PITCH, JUKE, QB READ |
| 37 | Lady Jandar | 3 | 3 | normal | - |
| 47 | Chris Heupgen | 4 | 4 | normal | - |
| 48 | Clay Moore | 4 | 4 | normal | - |
| 51 | Diego Montoya | 5 | 5 | normal | - |
| 56 | Hattori 'The Demon' Hanzo | 5 | 5 | normal | - |
| 68 | John Keefauver | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "FALCHIONS", "players": [{"num": 66, "name": "Juan Julio", "skill": 6, "move": 6, "abilities": ["CATCH"], "tier": "impact"}, {"num": 7, "name": "Vic Mexico", "skill": 7, "move": 7, "abilities": ["PITCH", "JUKE", "QB READ"], "tier": "superstar"}, {"num": 37, "name": "Lady Jandar", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 47, "name": "Chris Heupgen", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 48, "name": "Clay Moore", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Diego Montoya", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 56, "name": "Hattori 'The Demon' Hanzo", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 68, "name": "John Keefauver", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

### GORILLAS  (team guide p.6)
- Colors: Navy helmet, white gorilla face logo, red facemask.
- Notes: Superstar defender Larry Trailer (top-3 blitzer). Elliot Manly brother of Bighorns' Phil Manly.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 55 | Larry Trailer | 5 | 5 | superstar | SHOVE, BLITZ, BLOCK +1 |
| 6 | Elliot Manly | 6 | 6 | impact | SCREEN PASSER |
| 39 | Joe Mazing | 3 | 3 | normal | - |
| 41 | Ola 'Primate' Falk | 4 | 4 | normal | - |
| 42 | Jerr Z. Gionti | 4 | 4 | normal | - |
| 51 | Kazzom Boomer | 5 | 5 | normal | - |
| 64 | Bam Hennessy | 6 | 6 | normal | - |
| 73 | Brent Spivey | 7 | 7 | normal |  ; INFERNO: any single skill while ON FIRE |

Team ability total (league cap 4): 4

```json
{"team": "GORILLAS", "players": [{"num": 55, "name": "Larry Trailer", "skill": 5, "move": 5, "abilities": ["SHOVE", "BLITZ", "BLOCK +1"], "tier": "superstar"}, {"num": 6, "name": "Elliot Manly", "skill": 6, "move": 6, "abilities": ["SCREEN PASSER"], "tier": "impact"}, {"num": 39, "name": "Joe Mazing", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 41, "name": "Ola 'Primate' Falk", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 42, "name": "Jerr Z. Gionti", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Kazzom Boomer", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 64, "name": "Bam Hennessy", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}, {"num": 73, "name": "Brent Spivey", "skill": 7, "move": 7, "abilities": [], "tier": "normal", "inferno": "INFERNO: any single skill while ON FIRE"}]}
```

### GREENBACKS  (team guide p.6)
- Colors: Yellow helmet, green-and-white '$' oval logo, dark green facemask.
- Notes: Pure pocket passing (Dodgers) with Ed Lazy's spin running threat.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 6 | Roger Dodgers | 6 | 6 | superstar | POCKET PASSER, DODGE, QB READ |
| 66 | Ed Lazy | 6 | 6 | impact | SPIN MOVE |
| 39 | Jonas Lindgrenen | 3 | 3 | normal | - |
| 46 | Nick 'The Big Manchego' Wild | 4 | 4 | normal | - |
| 47 | Blonde Jeremy | 4 | 4 | normal | - |
| 51 | Caleb Rademaker | 5 | 5 | normal | - |
| 52 | Bryce Rademaker | 5 | 5 | normal | - |
| 75 | Sam Robinson | 7 | 7 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "GREENBACKS", "players": [{"num": 6, "name": "Roger Dodgers", "skill": 6, "move": 6, "abilities": ["POCKET PASSER", "DODGE", "QB READ"], "tier": "superstar"}, {"num": 66, "name": "Ed Lazy", "skill": 6, "move": 6, "abilities": ["SPIN MOVE"], "tier": "impact"}, {"num": 39, "name": "Jonas Lindgrenen", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 46, "name": "Nick 'The Big Manchego' Wild", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 47, "name": "Blonde Jeremy", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Caleb Rademaker", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 52, "name": "Bryce Rademaker", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 75, "name": "Sam Robinson", "skill": 7, "move": 7, "abilities": [], "tier": "normal"}]}
```

### GRIFFONS  (team guide p.7)
- Colors: White helmet, crimson griffon logo, gray facemask.
- Notes: Plumber/Gerald passing combo; Knees open-field tackler/outside blitzer.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 6 | Mario Plumber | 6 | 6 | impact | ROUTE PASSER |
| 66 | Willie A. Knees | 6 | 6 | impact | TACKLE +1 |
| 77 | Fritz Gerald | 7 | 7 | star | CATCH, SHAKE |
| 39 | J.R. Tracy | 3 | 3 | normal | - |
| 43 | Duke Cleo | 4 | 4 | normal | - |
| 48 | Yored | 4 | 4 | normal | - |
| 51 | Buck Beak | 5 | 5 | normal | - |
| 59 | Jandar Pygmy | 5 | 5 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "GRIFFONS", "players": [{"num": 6, "name": "Mario Plumber", "skill": 6, "move": 6, "abilities": ["ROUTE PASSER"], "tier": "impact"}, {"num": 66, "name": "Willie A. Knees", "skill": 6, "move": 6, "abilities": ["TACKLE +1"], "tier": "impact"}, {"num": 77, "name": "Fritz Gerald", "skill": 7, "move": 7, "abilities": ["CATCH", "SHAKE"], "tier": "star"}, {"num": 39, "name": "J.R. Tracy", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 43, "name": "Duke Cleo", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 48, "name": "Yored", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Buck Beak", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 59, "name": "Jandar Pygmy", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}]}
```

### JACK-O-LANTERNS  (team guide p.7)
- Colors: Orange helmet with black jack-o'-lantern face (stitched mouth), black facemask.
- Notes: Star Blellow, impact Sesentayseis; Tacos strength + zone defender.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 55 | Spike Tacos | 5 | 5 | impact | ZONE DEFENDER |
| 66 | Chad Sesentayseis | 6 | 6 | impact | SPIN MOVE |
| 7 | A. J. Blellow | 7 | 7 | star | CATCH, SHAKE |
| 35 | Anthony Spencer | 3 | 3 | normal | - |
| 46 | Brandon 'Big Easy' Hodges | 4 | 4 | normal | - |
| 49 | Jackman | 4 | 4 | normal | - |
| 51 | Steven Bond | 5 | 5 | normal | - |
| 64 | Boo Boo Eison | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "JACK-O-LANTERNS", "players": [{"num": 55, "name": "Spike Tacos", "skill": 5, "move": 5, "abilities": ["ZONE DEFENDER"], "tier": "impact"}, {"num": 66, "name": "Chad Sesentayseis", "skill": 6, "move": 6, "abilities": ["SPIN MOVE"], "tier": "impact"}, {"num": 7, "name": "A. J. Blellow", "skill": 7, "move": 7, "abilities": ["CATCH", "SHAKE"], "tier": "star"}, {"num": 35, "name": "Anthony Spencer", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 46, "name": "Brandon 'Big Easy' Hodges", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 49, "name": "Jackman", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Steven Bond", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 64, "name": "Boo Boo Eison", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

### KITTENS  (team guide p.8)
- Colors: White/silver helmet, black cat with blue yarn ball logo, blue facemask.
- Notes: Superstar RB Harry Danders.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 44 | Gavin Lover | 4 | 4 | impact | TEAM PLAYER |
| 7 | Harry Danders | 7 | 7 | superstar | JUKE, SQUEEZE PLAY, STIFF ARM |
| 39 | Darren 'Minion' Manoharan | 3 | 3 | normal | - |
| 45 | R. J. 'Bubby' Morris | 4 | 4 | normal | - |
| 51 | Greg Winter | 5 | 5 | normal | - |
| 58 | Anthony Sarlo | 5 | 5 | normal | - |
| 61 | Tim T-Bone | 6 | 6 | normal | - |
| 65 | Michael Pfisterer | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "KITTENS", "players": [{"num": 44, "name": "Gavin Lover", "skill": 4, "move": 4, "abilities": ["TEAM PLAYER"], "tier": "impact"}, {"num": 7, "name": "Harry Danders", "skill": 7, "move": 7, "abilities": ["JUKE", "SQUEEZE PLAY", "STIFF ARM"], "tier": "superstar"}, {"num": 39, "name": "Darren 'Minion' Manoharan", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 45, "name": "R. J. 'Bubby' Morris", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Greg Winter", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 58, "name": "Anthony Sarlo", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 61, "name": "Tim T-Bone", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}, {"num": 65, "name": "Michael Pfisterer", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

### LUMBERJACKS  (team guide p.8)
- Colors: Gold helmet, lumberjack 'LUMBERJACKS' logo, red facemask.
- Notes: 'Dakota to Nice' passing game.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 70 | Larry Nice | 7 | 7 | impact | SHAKE |
| 6 | Joe Dakota | 6 | 6 | superstar | ROUTE PASSER, SCREEN PASSER, QB READ |
| 36 | Niko Payrett | 3 | 3 | normal | - |
| 46 | Nathan 'Psyche' Ward | 4 | 4 | normal | - |
| 47 | Franck 'The Tank' Lefebvre | 4 | 4 | normal | - |
| 51 | Keven Ruest | 5 | 5 | normal | - |
| 52 | Fluke Bore | 5 | 5 | normal | - |
| 63 | Richard 'Redwood' Stout | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "LUMBERJACKS", "players": [{"num": 70, "name": "Larry Nice", "skill": 7, "move": 7, "abilities": ["SHAKE"], "tier": "impact"}, {"num": 6, "name": "Joe Dakota", "skill": 6, "move": 6, "abilities": ["ROUTE PASSER", "SCREEN PASSER", "QB READ"], "tier": "superstar"}, {"num": 36, "name": "Niko Payrett", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 46, "name": "Nathan 'Psyche' Ward", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 47, "name": "Franck 'The Tank' Lefebvre", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Keven Ruest", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 52, "name": "Fluke Bore", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 63, "name": "Richard 'Redwood' Stout", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

### MONSTERS  (team guide p.9)
- Colors: Navy helmet, orange fanged monster logo, orange facemask.
- Notes: 'Monsters of the Midfield'; advanced team built on Block Party synergy (Freezer) feeding Payday/Solitary.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 33 | Perry Freezer | 3 | 3 | impact | BLOCK PARTY |
| 55 | Mike Solitary | 5 | 5 | impact | BLITZ |
| 7 | Walt Payday | 7 | 7 | star | JUKE, RUN BLOCK |
| 48 | Josh Aldis-Snow | 4 | 4 | normal | - |
| 49 | Jonny 'The Punisher' Peletis | 4 | 4 | normal | - |
| 51 | Jake Jamelli | 5 | 5 | normal | - |
| 61 | Payton Johnston | 6 | 6 | normal | - |
| 69 | Spencer Harstead | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "MONSTERS", "players": [{"num": 33, "name": "Perry Freezer", "skill": 3, "move": 3, "abilities": ["BLOCK PARTY"], "tier": "impact"}, {"num": 55, "name": "Mike Solitary", "skill": 5, "move": 5, "abilities": ["BLITZ"], "tier": "impact"}, {"num": 7, "name": "Walt Payday", "skill": 7, "move": 7, "abilities": ["JUKE", "RUN BLOCK"], "tier": "star"}, {"num": 48, "name": "Josh Aldis-Snow", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 49, "name": "Jonny 'The Punisher' Peletis", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Jake Jamelli", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 61, "name": "Payton Johnston", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}, {"num": 69, "name": "Spencer Harstead", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

### NINJAS  (team guide p.9)
- Colors: Black helmet, purple/gold ninja logo, black facemask.
- Notes: Defense: 'Smoke Bomb' coverage (Earl Red) + 'Ninja Blitz' (Lou Ray).

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 55 | Lou Ray | 5 | 5 | star | BLITZ, LOCKDOWN |
| 77 | Earl Red | 7 | 7 | star | ZONE DEFENDER, INTERCEPTOR |
| 36 | Wes Baker | 3 | 3 | normal | - |
| 48 | Bruise Lee | 4 | 4 | normal | - |
| 49 | Air Xavier | 4 | 4 | normal | - |
| 51 | Darren Hanfland | 5 | 5 | normal | - |
| 64 | Robert 'Hobbit' Newman | 6 | 6 | normal | - |
| 67 | Brayden Spivey | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "NINJAS", "players": [{"num": 55, "name": "Lou Ray", "skill": 5, "move": 5, "abilities": ["BLITZ", "LOCKDOWN"], "tier": "star"}, {"num": 77, "name": "Earl Red", "skill": 7, "move": 7, "abilities": ["ZONE DEFENDER", "INTERCEPTOR"], "tier": "star"}, {"num": 36, "name": "Wes Baker", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 48, "name": "Bruise Lee", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 49, "name": "Air Xavier", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Darren Hanfland", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 64, "name": "Robert 'Hobbit' Newman", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}, {"num": 67, "name": "Brayden Spivey", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

### OMEGAS  (team guide p.10)
- Colors: White helmet, navy 'OMEGAS' omega logo, navy facemask.
- Notes: High scoring offense.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 6 | Andy Fortune | 6 | 6 | impact | ROUTE PASSER |
| 66 | Dick Erickson | 6 | 6 | star | RUN BLOCK, STIFF ARM |
| 77 | Harold Marvin | 7 | 7 | impact | SHAKE |
| 36 | Joe Sunday | 3 | 3 | normal | - |
| 48 | James Sibo | 4 | 4 | normal | - |
| 49 | May Flower | 4 | 4 | normal | - |
| 51 | Erick Kratos | 5 | 5 | normal | - |
| 52 | Stephen Rochelle | 5 | 5 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "OMEGAS", "players": [{"num": 6, "name": "Andy Fortune", "skill": 6, "move": 6, "abilities": ["ROUTE PASSER"], "tier": "impact"}, {"num": 66, "name": "Dick Erickson", "skill": 6, "move": 6, "abilities": ["RUN BLOCK", "STIFF ARM"], "tier": "star"}, {"num": 77, "name": "Harold Marvin", "skill": 7, "move": 7, "abilities": ["SHAKE"], "tier": "impact"}, {"num": 36, "name": "Joe Sunday", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 48, "name": "James Sibo", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 49, "name": "May Flower", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Erick Kratos", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 52, "name": "Stephen Rochelle", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}]}
```

### PANDAS  (team guide p.10)
- Colors: White panda-face helmet with black facemask and light-blue accents/clip.
- Notes: Patience/finesse offense.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 55 | Julian Salts | 5 | 5 | impact | BLITZ |
| 6 | Cameron Dyne | 6 | 6 | impact | SPIN MOVE |
| 7 | Steve Vaughn | 7 | 7 | star | CATCH, JUKE |
| 36 | Jason Chae | 3 | 3 | normal | - |
| 42 | Brian Thompson | 4 | 4 | normal | - |
| 47 | Scott Greer | 4 | 4 | normal | - |
| 51 | Sammy Miles Jr. | 5 | 5 | normal | - |
| 68 | Ian Leighly | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "PANDAS", "players": [{"num": 55, "name": "Julian Salts", "skill": 5, "move": 5, "abilities": ["BLITZ"], "tier": "impact"}, {"num": 6, "name": "Cameron Dyne", "skill": 6, "move": 6, "abilities": ["SPIN MOVE"], "tier": "impact"}, {"num": 7, "name": "Steve Vaughn", "skill": 7, "move": 7, "abilities": ["CATCH", "JUKE"], "tier": "star"}, {"num": 36, "name": "Jason Chae", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 42, "name": "Brian Thompson", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 47, "name": "Scott Greer", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Sammy Miles Jr.", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 68, "name": "Ian Leighly", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

### PILLS  (team guide p.11)
- Colors: White helmet, red capsule in blue ring logo, blue facemask with red clip.
- Notes: Balanced high octane offense; Kelly James (female QB).

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 5 | Kelly James | 5 | 5 | impact | POCKET PASSER |
| 60 | Andrew Tweed | 6 | 6 | impact | CATCH |
| 66 | Orlando Juice | 6 | 6 | impact | STIFF ARM |
| 7 | Tomas Thurston | 7 | 7 | impact | JUKE |
| 31 | Patrick 'Fish Squisher' Downey | 3 | 3 | normal | - |
| 41 | Jason Webster | 4 | 4 | normal | - |
| 49 | Bruise Pilliams | 4 | 4 | normal | - |
| 51 | Anthony 'Schiz' Albano | 5 | 5 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "PILLS", "players": [{"num": 5, "name": "Kelly James", "skill": 5, "move": 5, "abilities": ["POCKET PASSER"], "tier": "impact"}, {"num": 60, "name": "Andrew Tweed", "skill": 6, "move": 6, "abilities": ["CATCH"], "tier": "impact"}, {"num": 66, "name": "Orlando Juice", "skill": 6, "move": 6, "abilities": ["STIFF ARM"], "tier": "impact"}, {"num": 7, "name": "Tomas Thurston", "skill": 7, "move": 7, "abilities": ["JUKE"], "tier": "impact"}, {"num": 31, "name": "Patrick 'Fish Squisher' Downey", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 41, "name": "Jason Webster", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 49, "name": "Bruise Pilliams", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Anthony 'Schiz' Albano", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}]}
```

### PIT BULLS  (team guide p.11)
- Colors: Yellow helmet, half-black/half-white pit bull circle logo, black facemask.
- Notes: 'CHAIN LINK' defense led by four impact players.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 33 | Joey Mean | 3 | 3 | impact | SHOVE |
| 44 | Harry Jammison | 4 | 4 | impact | TEAM PLAYER |
| 55 | Roy Gonnamaulu | 5 | 5 | impact | BLITZ |
| 66 | Ron Woodsman | 6 | 6 | impact | TACKLE +1 |
| 43 | Sam Tyson | 4 | 4 | normal | - |
| 51 | Raymond Starfire | 5 | 5 | normal | - |
| 62 | Jason Guzman | 6 | 6 | normal | - |
| 78 | Mark Nealon | 7 | 7 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "PIT BULLS", "players": [{"num": 33, "name": "Joey Mean", "skill": 3, "move": 3, "abilities": ["SHOVE"], "tier": "impact"}, {"num": 44, "name": "Harry Jammison", "skill": 4, "move": 4, "abilities": ["TEAM PLAYER"], "tier": "impact"}, {"num": 55, "name": "Roy Gonnamaulu", "skill": 5, "move": 5, "abilities": ["BLITZ"], "tier": "impact"}, {"num": 66, "name": "Ron Woodsman", "skill": 6, "move": 6, "abilities": ["TACKLE +1"], "tier": "impact"}, {"num": 43, "name": "Sam Tyson", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Raymond Starfire", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 62, "name": "Jason Guzman", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}, {"num": 78, "name": "Mark Nealon", "skill": 7, "move": 7, "abilities": [], "tier": "normal"}]}
```

### RAGNAROK  (team guide p.12)
- Colors: Purple helmet with gold Norse serpent/knotwork, gold facemask.
- Notes: Spread defenses wide (Lichen sideline work); Thor runs/blocks.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 6 | Thor Odinson | 6 | 6 | star | RUN BLOCK, BLOCK +1 |
| 7 | Randy Lichen | 7 | 7 | star | CATCH, SIDELINER |
| 38 | Jordin Peterson | 3 | 3 | normal | - |
| 45 | Darren Olsen | 4 | 4 | normal | - |
| 46 | Alex Skayne | 4 | 4 | normal | - |
| 51 | Scott Boggs | 5 | 5 | normal | - |
| 59 | Alex Salem | 5 | 5 | normal | - |
| 65 | Chuck Theel | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "RAGNAROK", "players": [{"num": 6, "name": "Thor Odinson", "skill": 6, "move": 6, "abilities": ["RUN BLOCK", "BLOCK +1"], "tier": "star"}, {"num": 7, "name": "Randy Lichen", "skill": 7, "move": 7, "abilities": ["CATCH", "SIDELINER"], "tier": "star"}, {"num": 38, "name": "Jordin Peterson", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 45, "name": "Darren Olsen", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 46, "name": "Alex Skayne", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Scott Boggs", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 59, "name": "Alex Salem", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 65, "name": "Chuck Theel", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

### RATTLERS  (team guide p.12)
- Colors: Navy helmet, red/black coiled rattlesnake logo, red facemask.
- Notes: Superstar blitzer J.J. Joule; Hammer hard to sack.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 4 | Ryan Hammer | 4 | 4 | impact | PITCH |
| 55 | J.J. Joule | 5 | 5 | superstar | BLITZ, BLOCK +1, DIVING TACKLE |
| 34 | Bruce Spivey | 3 | 3 | normal | - |
| 45 | Andrew Olson | 4 | 4 | normal | - |
| 51 | Jeff 'TNT' Paul | 5 | 5 | normal | - |
| 63 | Big Daddy Grubaugh | 6 | 6 | normal | - |
| 68 | Jaina Andreson | 6 | 6 | normal | - |
| 75 | Glenn Manser | 7 | 7 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "RATTLERS", "players": [{"num": 4, "name": "Ryan Hammer", "skill": 4, "move": 4, "abilities": ["PITCH"], "tier": "impact"}, {"num": 55, "name": "J.J. Joule", "skill": 5, "move": 5, "abilities": ["BLITZ", "BLOCK +1", "DIVING TACKLE"], "tier": "superstar"}, {"num": 34, "name": "Bruce Spivey", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 45, "name": "Andrew Olson", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Jeff 'TNT' Paul", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 63, "name": "Big Daddy Grubaugh", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}, {"num": 68, "name": "Jaina Andreson", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}, {"num": 75, "name": "Glenn Manser", "skill": 7, "move": 7, "abilities": [], "tier": "normal"}]}
```

### REAPERS  (team guide p.13)
- Colors: White/silver helmet, black grim reaper logo, black facemask.
- Notes: Superstar Donnie 'D-Lock' Lock: blitzer and open-field tackler.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 44 | Howie Short | 4 | 4 | impact | BLITZ |
| 77 | Donnie Lock | 7 | 7 | superstar | TACKLE +3 |
| 31 | Chris Cuddy | 3 | 3 | normal | - |
| 41 | Daniel 'The Bear' McKay | 4 | 4 | normal | - |
| 51 | Chopper Lewis | 5 | 5 | normal | - |
| 58 | Bill Door | 5 | 5 | normal | - |
| 65 | Weapon Xtreme | 6 | 6 | normal | - |
| 67 | Marcus Ervin III | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

ALTERNATE LINEUP: Alternate lineup: #44 Howie Short -> #4 John McFadden (impact: Shove; note number 4 not 44, both skill 4); #77 Donnie Lock -> #77 Bo Nose (superstar: Juke, Stiff Arm, Sideliner).

```json
{"team": "REAPERS", "players": [{"num": 44, "name": "Howie Short", "skill": 4, "move": 4, "abilities": ["BLITZ"], "tier": "impact"}, {"num": 77, "name": "Donnie Lock", "skill": 7, "move": 7, "abilities": ["TACKLE +3"], "tier": "superstar"}, {"num": 31, "name": "Chris Cuddy", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 41, "name": "Daniel 'The Bear' McKay", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Chopper Lewis", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 58, "name": "Bill Door", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 65, "name": "Weapon Xtreme", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}, {"num": 67, "name": "Marcus Ervin III", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}], "alternate": {"note": "Alternate lineup: #44 Howie Short -> #4 John McFadden (impact: Shove; note number 4 not 44, both skill 4); #77 Donnie Lock -> #77 Bo Nose (superstar: Juke, Stiff Arm, Sideliner).", "replacements": [{"num": 4, "name": "John McFadden", "skill": 4, "move": 4, "abilities": ["SHOVE"], "tier": "impact"}, {"num": 77, "name": "Bo Nose", "skill": 7, "move": 7, "abilities": ["JUKE", "STIFF ARM", "SIDELINER"], "tier": "superstar"}]}}
```

### REGALS  (team guide p.13)
- Colors: Dark teal/green helmet, white/gray lion head logo, gray facemask. Official name REGAL LIONS.
- Notes: Superstar passer Quentin Bartholomew Eagles (QB Read named after him).

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 6 | Mack Koi | 6 | 6 | impact | SPIN MOVE |
| 7 | Quentin Bartholomew Eagles | 7 | 7 | superstar | JUKE, ROUTE PASSER, QB READ |
| 34 | Roberto Ordonez | 3 | 3 | normal | - |
| 48 | Markus Gustav Igel | 4 | 4 | normal | - |
| 49 | Joey Scar | 4 | 4 | normal | - |
| 51 | Alex 'Frenchie' Theys | 5 | 5 | normal | - |
| 56 | Clem 'Mister Green' Dokines | 5 | 5 | normal | - |
| 63 | Matt Gort | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "REGALS", "players": [{"num": 6, "name": "Mack Koi", "skill": 6, "move": 6, "abilities": ["SPIN MOVE"], "tier": "impact"}, {"num": 7, "name": "Quentin Bartholomew Eagles", "skill": 7, "move": 7, "abilities": ["JUKE", "ROUTE PASSER", "QB READ"], "tier": "superstar"}, {"num": 34, "name": "Roberto Ordonez", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 48, "name": "Markus Gustav Igel", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 49, "name": "Joey Scar", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Alex 'Frenchie' Theys", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 56, "name": "Clem 'Mister Green' Dokines", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 63, "name": "Matt Gort", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

### REVOLT  (team guide p.14)
- Colors: Light blue helmet, orange/yellow lightning bolt with fist logo, yellow facemask.
- Notes: 'Option Offense'.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 6 | Don Fast | 6 | 6 | star | PITCH, OPTION |
| 7 | Larry Thompson | 7 | 7 | star | JUKE, SPIN MOVE |
| 38 | A.C. Ohmic | 3 | 3 | normal | - |
| 46 | Shane Fitzgerald | 4 | 4 | normal | - |
| 49 | Zach 'Coulomb' Croy | 4 | 4 | normal | - |
| 51 | Nick Tesla | 5 | 5 | normal | - |
| 59 | Harry Wheeler | 5 | 5 | normal | - |
| 64 | J R Angus | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "REVOLT", "players": [{"num": 6, "name": "Don Fast", "skill": 6, "move": 6, "abilities": ["PITCH", "OPTION"], "tier": "star"}, {"num": 7, "name": "Larry Thompson", "skill": 7, "move": 7, "abilities": ["JUKE", "SPIN MOVE"], "tier": "star"}, {"num": 38, "name": "A.C. Ohmic", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 46, "name": "Shane Fitzgerald", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 49, "name": "Zach 'Coulomb' Croy", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Nick Tesla", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 59, "name": "Harry Wheeler", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 64, "name": "J R Angus", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

### SPACESHIPS  (team guide p.14)
- Colors: White helmet, green rocket 'SPACE SHIPS' logo, dark green facemask.
- Notes: Mix of skills among four impact players.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 33 | Mary Gold | 3 | 3 | impact | TEAM PLAYER |
| 5 | Patrick Fritz | 5 | 5 | impact | POCKET PASSER |
| 66 | Derek Reeves | 6 | 6 | impact | ZONE DEFENDER |
| 7 | Mark Curtis | 7 | 7 | impact | SPIN MOVE |
| 41 | Todd 'The Grognard' Warren | 4 | 4 | normal | - |
| 47 | Matt Mancuso | 4 | 4 | normal | - |
| 51 | Millennium Solo | 5 | 5 | normal | - |
| 67 | David Forest | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "SPACESHIPS", "players": [{"num": 33, "name": "Mary Gold", "skill": 3, "move": 3, "abilities": ["TEAM PLAYER"], "tier": "impact"}, {"num": 5, "name": "Patrick Fritz", "skill": 5, "move": 5, "abilities": ["POCKET PASSER"], "tier": "impact"}, {"num": 66, "name": "Derek Reeves", "skill": 6, "move": 6, "abilities": ["ZONE DEFENDER"], "tier": "impact"}, {"num": 7, "name": "Mark Curtis", "skill": 7, "move": 7, "abilities": ["SPIN MOVE"], "tier": "impact"}, {"num": 41, "name": "Todd 'The Grognard' Warren", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 47, "name": "Matt Mancuso", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Millennium Solo", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 67, "name": "David Forest", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

### SUSHI  (team guide p.15)
- Colors: White helmet, teal sushi-roll character logo, teal facemask with orange clip.
- Notes: Pocket passing star Stan Marina.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 55 | Larry Bonkers | 5 | 5 | impact | RUN BLOCK |
| 6 | Stan Marina | 6 | 6 | star | ROUTE PASSER, POCKET PASSER |
| 66 | Mark Super | 6 | 6 | impact | SPIN MOVE |
| 31 | Peter Greico | 3 | 3 | normal | - |
| 42 | Alison Giordano | 4 | 4 | normal | - |
| 43 | Heather Peletis | 4 | 4 | normal | - |
| 51 | Tom Sophie | 5 | 5 | normal | - |
| 71 | John Wiser | 7 | 7 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "SUSHI", "players": [{"num": 55, "name": "Larry Bonkers", "skill": 5, "move": 5, "abilities": ["RUN BLOCK"], "tier": "impact"}, {"num": 6, "name": "Stan Marina", "skill": 6, "move": 6, "abilities": ["ROUTE PASSER", "POCKET PASSER"], "tier": "star"}, {"num": 66, "name": "Mark Super", "skill": 6, "move": 6, "abilities": ["SPIN MOVE"], "tier": "impact"}, {"num": 31, "name": "Peter Greico", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 42, "name": "Alison Giordano", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 43, "name": "Heather Peletis", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Tom Sophie", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 71, "name": "John Wiser", "skill": 7, "move": 7, "abilities": [], "tier": "normal"}]}
```

### TRIDENTS  (team guide p.15)
- Colors: White helmet, Poseidon in red/white/blue shield logo, navy facemask.
- Notes: First team to draft a female player (Mary Iota).

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 40 | Mike Money | 4 | 4 | impact | BLOCK +1 |
| 44 | Max Bruce | 4 | 4 | impact | TEAM PLAYER |
| 6 | Mary Iota | 6 | 6 | impact | ROUTE PASSER |
| 7 | George Edwards | 7 | 7 | impact | SPIN MOVE |
| 37 | Sarah McNeely | 3 | 3 | normal | - |
| 51 | Daniel George | 5 | 5 | normal | - |
| 54 | Darrell Sackman | 5 | 5 | normal | - |
| 63 | Derrick Nathan | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "TRIDENTS", "players": [{"num": 40, "name": "Mike Money", "skill": 4, "move": 4, "abilities": ["BLOCK +1"], "tier": "impact"}, {"num": 44, "name": "Max Bruce", "skill": 4, "move": 4, "abilities": ["TEAM PLAYER"], "tier": "impact"}, {"num": 6, "name": "Mary Iota", "skill": 6, "move": 6, "abilities": ["ROUTE PASSER"], "tier": "impact"}, {"num": 7, "name": "George Edwards", "skill": 7, "move": 7, "abilities": ["SPIN MOVE"], "tier": "impact"}, {"num": 37, "name": "Sarah McNeely", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Daniel George", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 54, "name": "Darrell Sackman", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 63, "name": "Derrick Nathan", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

### TRUCKS  (team guide p.16)
- Colors: Silver/gray helmet, black skull-and-wrenches flag logo, red facemask.
- Notes: 'Big Block' offense with Al Stop power running.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 33 | Al Stop | 3 | 3 | star | SHOVE, BLOCK +1 |
| 44 | Warren Sack | 4 | 4 | impact | SHOVE |
| 55 | Derrin Books | 5 | 5 | impact | BLITZ |
| 43 | Pablo Desviat Cruzado | 4 | 4 | normal | - |
| 51 | Christopher Rixen | 5 | 5 | normal | - |
| 65 | Eric 'No' Sack | 6 | 6 | normal |  ; INFERNO: gains QB READ while ON FIRE |
| 68 | Pete Shirey | 6 | 6 | normal | - |
| 79 | Evan Vernon | 7 | 7 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "TRUCKS", "players": [{"num": 33, "name": "Al Stop", "skill": 3, "move": 3, "abilities": ["SHOVE", "BLOCK +1"], "tier": "star"}, {"num": 44, "name": "Warren Sack", "skill": 4, "move": 4, "abilities": ["SHOVE"], "tier": "impact"}, {"num": 55, "name": "Derrin Books", "skill": 5, "move": 5, "abilities": ["BLITZ"], "tier": "impact"}, {"num": 43, "name": "Pablo Desviat Cruzado", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Christopher Rixen", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 65, "name": "Eric 'No' Sack", "skill": 6, "move": 6, "abilities": [], "tier": "normal", "inferno": "INFERNO: gains QB READ while ON FIRE"}, {"num": 68, "name": "Pete Shirey", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}, {"num": 79, "name": "Evan Vernon", "skill": 7, "move": 7, "abilities": [], "tier": "normal"}]}
```

### TYRANTS  (team guide p.16)
- Colors: Green T-rex helmet graphic, blue-gray facemask.
- Notes: Pass defense.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 60 | Ken Chance | 6 | 6 | impact | ZONE DEFENDER |
| 66 | Tom Earl | 6 | 6 | impact | MAN DEFENDER |
| 77 | Rex Surewin | 7 | 7 | star | ZONE DEFENDER, INTERCEPTOR |
| 34 | Warren 'Wazza' Fenton | 3 | 3 | normal | - |
| 43 | Walter Jo-Daniels | 4 | 4 | normal | - |
| 46 | Kam Wow | 4 | 4 | normal | - |
| 51 | Erikk Teschlog | 5 | 5 | normal | - |
| 56 | Christian Muhl | 5 | 5 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "TYRANTS", "players": [{"num": 60, "name": "Ken Chance", "skill": 6, "move": 6, "abilities": ["ZONE DEFENDER"], "tier": "impact"}, {"num": 66, "name": "Tom Earl", "skill": 6, "move": 6, "abilities": ["MAN DEFENDER"], "tier": "impact"}, {"num": 77, "name": "Rex Surewin", "skill": 7, "move": 7, "abilities": ["ZONE DEFENDER", "INTERCEPTOR"], "tier": "star"}, {"num": 34, "name": "Warren 'Wazza' Fenton", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 43, "name": "Walter Jo-Daniels", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 46, "name": "Kam Wow", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Erikk Teschlog", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 56, "name": "Christian Muhl", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}]}
```

### WARRIORS  (team guide p.17)
- Colors: White helmet, blue soldier in red/blue shield 'WARRIORS' logo, red facemask with blue clip.
- Notes: Aerial assault: Baby to Black and Knockowski. Motto 'Fighting Inflation!'.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 55 | Rock Knockowski | 5 | 5 | star | STIFF ARM, RUN BLOCK |
| 6 | Tom Baby | 6 | 6 | impact | POCKET PASSER |
| 66 | Troy Black | 6 | 6 | impact | CATCH |
| 39 | Richard Pants | 3 | 3 | normal | - |
| 46 | Chalupa Wayne | 4 | 4 | normal | - |
| 49 | Jan Kador | 4 | 4 | normal | - |
| 51 | Brady Cowette | 5 | 5 | normal | - |
| 71 | Jordan 'J-Town' Nickle | 7 | 7 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "WARRIORS", "players": [{"num": 55, "name": "Rock Knockowski", "skill": 5, "move": 5, "abilities": ["STIFF ARM", "RUN BLOCK"], "tier": "star"}, {"num": 6, "name": "Tom Baby", "skill": 6, "move": 6, "abilities": ["POCKET PASSER"], "tier": "impact"}, {"num": 66, "name": "Troy Black", "skill": 6, "move": 6, "abilities": ["CATCH"], "tier": "impact"}, {"num": 39, "name": "Richard Pants", "skill": 3, "move": 3, "abilities": [], "tier": "normal"}, {"num": 46, "name": "Chalupa Wayne", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 49, "name": "Jan Kador", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Brady Cowette", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 71, "name": "Jordan 'J-Town' Nickle", "skill": 7, "move": 7, "abilities": [], "tier": "normal"}]}
```

### YELLOW JACKETS  (team guide p.17)
- Colors: Black helmet, yellow muscular bee logo, black facemask with teal clip.
- Notes: Superstar lineman Tony Boss on both sides; Freddy Thunder stiff arms.

| # | Name | Skill | Move | Tier | Abilities |
|---|---|---|---|---|---|
| 33 | Tony Boss | 3 | 3 | superstar | SHOVE, BLOCK +1, TEAM PLAYER |
| 7 | Freddy Thunder | 7 | 7 | impact | STIFF ARM |
| 45 | Charlie Cox | 4 | 4 | normal | - |
| 46 | P.W. Sweezy | 4 | 4 | normal | - |
| 51 | Sean 'El Fuego' Blanco | 5 | 5 | normal | - |
| 58 | Lenny La France | 5 | 5 | normal | - |
| 61 | Walter Greer | 6 | 6 | normal | - |
| 68 | Kail Kordan | 6 | 6 | normal | - |

Team ability total (league cap 4): 4

```json
{"team": "YELLOW JACKETS", "players": [{"num": 33, "name": "Tony Boss", "skill": 3, "move": 3, "abilities": ["SHOVE", "BLOCK +1", "TEAM PLAYER"], "tier": "superstar"}, {"num": 7, "name": "Freddy Thunder", "skill": 7, "move": 7, "abilities": ["STIFF ARM"], "tier": "impact"}, {"num": 45, "name": "Charlie Cox", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 46, "name": "P.W. Sweezy", "skill": 4, "move": 4, "abilities": [], "tier": "normal"}, {"num": 51, "name": "Sean 'El Fuego' Blanco", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 58, "name": "Lenny La France", "skill": 5, "move": 5, "abilities": [], "tier": "normal"}, {"num": 61, "name": "Walter Greer", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}, {"num": 68, "name": "Kail Kordan", "skill": 6, "move": 6, "abilities": [], "tier": "normal"}]}
```

## 2. Skills / special abilities (rulebook pp.15-18)

### 2.0 General skill framework (p.15)
- **PLAYMAKER die**: an extra d6 (use a different color) rolled alongside the 2d6 of a skill check. Max ONE playmaker die added to any particular skill check, regardless of how many playmaker abilities apply. Triggers on doubles: when the playmaker die matches either of the 2d6, its ability usually triggers (some require the final check result to be a success or failure - stated per skill).
- All playmaker abilities in standard modes are **passive**: used only when the opponent targets the player who has the ability. Passive playmaker works by **negation**: a playmaker die matching a skill die negates (removes) that skill die's result. This can turn a success into failure, or total into partial. If the check ends as a failure there are usually extra effects (knock down, swap squares). (Implementation note: the text does not say what replaces a negated die - most natural reading: that die counts as 0 in the 2d6 total. FLAG: ambiguous.)
- **Multiple "as part of a move action" skills in one activation** (stars/superstars):
  - Each action type / skill check may be attempted only once per activation. Exception: hand-off (incl. pitch) - unlimited attempts as long as no sport check fails.
  - Only the LAST skill check of the activation determines total/partial/failure; earlier results are ignored for activation-generation purposes (but their in-game effects still happen). E.g. TS, TS, then fail -> opponent gets a free activation, the superstar gets none. Three TS -> only one free activation.
  - Player must finish his entire activation before the opponent can respond to a partial or total success.
  - Hand-off is a sport check, not a skill check: if a run-blocker gets a TS on his block, then the hand-off fails (scatter, activation ends), the TS still stands and still grants the free activation. A failed SKILL check would instead negate it and give the opponent the free activation.
- **+ skills**: "+1/+2/+3" after a fundamental ability = that bonus on that action; each plus counts as one ability (Block +3 = superstar). An advanced skill with a plus counts as 1 ability + 1 per plus (Juke +2 = 3 abilities). Rule of 3 still caps the check at +3 total; further bonuses have no effect.

### 2.1 Skill list (25): BLITZ, BLOCK +1, BLOCK PARTY, CATCH, DIVING TACKLE, DODGE, INTERCEPTOR, JUKE, LOCKDOWN, MAN DEFENDER, OPTION, PITCH, POCKET PASSER, QB READ, ROUTE PASSER, RUN BLOCK, SCREEN PASSER, SHAKE, SHOVE, SIDELINER, SPIN MOVE, SQUEEZE PLAY, STIFF ARM, TACKLE +1, TEAM PLAYER, ZONE DEFENDER. (Also appearing on rosters: TACKLE +3 = Tackle with +3.)

- **BLITZ**: on defense, the player may perform a block *as part of a move action*.
- **BLOCK +1**: +1 bonus when blocking (also applies to shove, since shove uses all block bonuses).
- **BLOCK PARTY**: when this player's block is a total success and generates a free activation for a teammate, if that teammate uses the free activation to perform a block of any sort (block, shove, blitz/run-block block...), that block gets an additional +2 bonus.
- **CATCH**: when a throw targets this player, his coach may also discard cards bearing the intended receiver's number from the bench for bench-boost bonus (+1 per card, 1:1). Example: passer's card used for +1, plus both #66 cards for +2 -> total +3. (Normally a bench boost may only use the acting player's number; Catch lets the receiver's cards count on the passer's check.)
- **DIVING TACKLE**: may perform a tackle *as part of a move action*. If the diving tackle fails the skill check, the tackler is knocked down.
- **DODGE**: after an opposing coach announces a block or tackle targeting this player, his coach may discard this player's cards from the bench to give that check -1 per card (1:1).
- **INTERCEPTOR**: if on defense and threatening the target (player or square) of an unsuccessful throw that would scatter, instead of scattering the ball is placed on this player. He must still pass a sport check (2d6, non-doubles) for the interception to succeed.
- **JUKE**: action performed *as part of a move action*; the juker must possess the ball. Resolved exactly like a block, but speed/dexterity based: the player with the HIGHER number gets the skill-difference bonus. Critical success (success + doubles): defender is pushed back AND knocked down. Same teamwork bonuses/penalties and the same critical success/failure effects as block (crit failure: juker pushed back & knocked down, fumble if carrying - he always is). Failure can be reversed like a block. (Juke is in the teamwork list.)
- **LOCKDOWN**: an opponent leaving a square threatened by a lockdown player is charged as if carrying the ball for that player's threat (3 instead of 2). Only the lockdown player's threat is affected; others calc normally. Example: offensive player without ball leaving a square threatened by 2 defenders, one with lockdown = 3 + 2 = 5 movement. No effect on a player benefiting from Sideliner (moving sideline square -> sideline square).
- **MAN DEFENDER**: on defense, when this player is threatening a player (in one of the 8 surrounding squares), throws to that offensive player get -3.
- **OPTION**: prerequisite: player must have PITCH. When a defensive player moves into a square threatening an offensive player with option, the defender's movement halts. The offensive coach decides whether to pitch. If he does, resolve the pitch, then the defender completes his remaining movement/actions. If not, play continues normally. Using option requires a sport check. (Lets the ball be pitched in reaction to a threatening defender - anti-sack/anti-blitz.)
- **PITCH**: identical to hand-off rules except the pitch may be made up to 3 spaces away (distance measured normally, incl. diagonal penalty). Any direction. A lateral/backward pitch that fails its sport check is fumbled and scattered normally. A forward pitch that fails its sport check is scattered as an airborne loose ball at its location (marked with red target token); it is considered a pass for timekeeping and a forward pass for determining whether you can throw the ball later. Rules-wise it is a hand-off (shovel pass flavor). Hand-off/pitch is repeatable within an activation.
- **POCKET PASSER**: after the last of the five initial play-call cards has been placed on the discard pile, the next pass on that down by a pocket passer gets +2 as long as: the ball was snapped to this player, and he has not moved. If involuntarily moved by the defense (block, shove, etc.) he still keeps the bonus.
- **QB READ**: normally offense may only read-and-react if the defense did. With QB Read, after the defensive coach decides whether to read-and-react, the offensive coach may perform a read-and-react with this player (even if defense didn't). The player must possess the football, and his card must be pulled from the bench to be used on the play.
- **ROUTE PASSER**: +1 bonus on throws that target an open square instead of a player.
- **RUN BLOCK**: on offense, may perform a block *as part of a move action*; may do so while possessing the football.
- **SCREEN PASSER**: +1 bonus when the pass target is behind the line of scrimmage.
- **SHAKE**: exactly like juke except the offensive player may NOT possess the ball. Not used on defense. *As part of a move action*. Teamwork & bench boost apply (TS -> free activation e.g. for the passer).
- **SHOVE**: special block; all block bonuses/penalties/rules/skills apply except movement: on success the target is pushed straight backward 2 spaces directly away from the shover. If he can't be moved the full 2 he is knocked down in the furthest space he reaches. After a successful shove, optional free follow-up move, which must be 2 squares if the target moved 2; follow-ups ignore threat movement penalties. Example: #44 shoving diagonally-adjacent #49 pushes him 2 squares diagonally, #44 may follow 2; shoving #51 (with #7 directly behind) -> #51 moves 1 and is knocked down in front of #7. Failure: target may reverse the shove onto the initiator.
- **SIDELINER**: on offense, when moving from a square directly adjacent to a sideline to another square directly adjacent to a sideline: without the ball, completely ignores opposing threat; with the ball, calculates threat as if he did NOT have the ball (normally 2 per threatening player instead of 3). Lockdown has no effect on him for such moves.
- **SPIN MOVE**: passive playmaker. When an opponent attempts to tackle this player, add a playmaker die to the tackle check. Match with either skill die negates that die. If playmaker matches either skill die and the tackle check is a failure, the spin-mover may swap squares with the failed tackler. If the playmaker matches BOTH skill dice, critical failure: the tackler is knocked down in addition to all other effects.
- **SQUEEZE PLAY**: may move across a diagonal even when players are on both sides of it (normally prohibited).
- **STIFF ARM**: passive playmaker. When an opponent attempts to tackle this player, add a playmaker die. Match with either skill die negates that die. If the playmaker matches either skill die and the tackle check is a failure, the tackler is knocked down. If it matches both skill dice: critical failure (flavor only; no extra in-game effect beyond the above).
- **TACKLE +1** (+3 for Donnie Lock): +1 (+3) bonus when tackling (diving tackle included).
- **TEAM PLAYER**: when providing teamwork this player gives +2 (on target, for own team) / -2 (to opponent's acting player) instead of +1/-1. Passive positional.
- **ZONE DEFENDER**: treated as threatening any square/player that is the target of a pass within 3 squares of him (measured normally) - i.e. counts for the pass's teamwork penalty (-1 per defender threatening the target) and presumably Interceptor's "threatening the target" (FLAG: interaction not explicit).

### 2.2 Skill classification (p.18, "not exhaustive")
- Teamwork skills (get teamwork bonuses/penalties): BLITZ, BLOCK +1, DIVING TACKLE, JUKE, RUN BLOCK, SHAKE, SHOVE, TACKLE +1, TEAM PLAYER. Spin move/stiff arm aren't directly affected by teamwork but the triggering tackle is.
- As part of a move action (each once per activation except hand-off incl. pitch): BLITZ, DIVING TACKLE, GRAB A LOOSE BALL, HAND-OFF, JUKE, PITCH, RUN BLOCK, SHAKE.
- Passive playmakers: SPIN MOVE, STIFF ARM.
- Passive positionals: INTERCEPTOR, LOCKDOWN, MAN DEFENDER, TEAM PLAYER, ZONE DEFENDER.
- Synergistic: BLOCK PARTY, TEAM PLAYER.

## 3. QRS / core rules

### 3.1 Skill check (QRS p.3, rulebook p.3)
- Roll 2d6 + net modifier. Rule of 3: sum bonuses (cap +3), sum penalties (cap -3) separately, then net. E.g. 4 bonuses & 3 penalties -> +3-3 = 0.
- **TOTAL SUCCESS = 10+**: effect resolves; after the activation completes, the owning coach may activate ANOTHER player on his team (not the one that just acted) for a FULL activation.
- **PARTIAL SUCCESS = 7-9**: effect resolves; then the opposing coach may take a MOVE action with ANY one of his players, limited to half that player's move allowance (rounded up).
- **FAILURE = 6 or less**: action does not occur, activation ends immediately. If reversible (block, shove, juke/shake per their text), the opponent may immediately reverse it (target resolves it against the initiator, no roll). After immediate effects/reversals, the opposing coach may perform a full activation with ANY player on his team.
- "Success" alone = 7-12 (final result). Critical success = success + doubles on the 2d6; critical failure = failure + doubles on the 2d6.
- Booth review summary: 10+ full activation for another own player; 7-9 half move (rounded up) for any opposing player; <=6 failure + full activation for any opposing player.
- Activations generated by checks can chain (actions by either side may generate further activations/reactions).
- Movement as part of a move action with TS: all of the actor's remaining movement/effects resolve before the bonus activation; with partial: the actor's additional movement is resolved before the opposing player's half move.

### 3.2 Sport check (QRS p.1, rulebook p.9)
- Roll 2d6: any non-doubles = success; any doubles = failure (5/6 success). NOT a skill check: failure gives the opponent NO action, success generates none; no modifiers. Failure ends the attempting player's turn immediately and the ball scatters.
- Used for: grabbing a loose ball (air or ground) - incl. interception/catching a scattered pass/pick up fumble; hand-off (and pitch) when EITHER player is threatened by an opponent; Option use; Interceptor.

### 3.3 Bench boost (QRS p.3, rulebook p.4)
- Before rolling, discard any number of cards with THAT acting player's number from the bench: +1 per card (1:1). Cards go to discard pile. Cannot exceed +3 cap. (Catch lets receiver's cards be used on a throw; Dodge lets defender's cards give -1 each.)

### 3.4 Teamwork (QRS p.3)
- +1 for each player on the active team threatening the TARGET; -1 for each opposing player threatening the player TAKING the action. Actor and target never count. Team Player gives +/-2. Passes use teamwork differently (see Pass).

### 3.5 Threat zone & movement (rulebook pp.4-5)
- Threat zone = the 8 surrounding squares (any skill). Knocked-down players do not threaten and cannot be blocked; their square can't be moved through (unless skill / fire token hurdle).
- Movement cost is charged for the square being LEFT: non-threatened = 1; threatened = 2 per opposing player threatening it; threatened while carrying ball = 3 per threatening opponent. Entering is free.
- Diagonal: first diagonal on an activation costs no extra; every other diagonal after the first (2nd, 4th, ... not necessarily consecutive) +1. Cannot cross a diagonal with players on both sides (any team) unless special rule (Squeeze Play).
- Cannot move through occupied squares. Voluntarily stepping out of bounds with the ball ends the play; ball spotted by the square he left.
- All measurements (move, pass range, scatter, pitch distance) count squares moved through with +1 for every other diagonal after the first.
- Standing up: knocked-down player stands as part of a move action, costs 3 movement, no check. Any activation of a knocked-down player must begin by standing up.

### 3.6 Activation & turn sequence (QRS p.1, rulebook p.3/p.12)
Down sequence: 1 offense sets formation (1 real minute) -> 2 defense sets formation (1 minute) -> 3 both call plays (simultaneous, 1 minute) -> 4 offense optional motion -> 5 defense optional motion -> 6 repeat 4-5 once (2nd motion costs 2 cards; 1st costs 1; 30 s limit each; discarded cards lost if motion not completed) -> 7 snap -> 8 play continues until tackle, out of bounds, score, incomplete pass (or safety/field goal).
- Offensive formation: ball on own 20 (80 yards to go). Hiker placed first; nobody in the two squares diagonally behind the hiker; >=3 on the LOS; the two other required LOS players within two squares of the hiker, one on each side; a player directly behind the hiker to receive the hike; any number on LOS and on the line directly behind it; up to 4 in the backfield in the three vertical lanes behind/either side of the hiker (incl. receiver). Fail to finish in 1 minute -> defense places the remaining players legally.
- Defensive formation: >=3 on LOS; any number on LOS; a defender on the LOS must threaten an offensive LOS player (1:1) before a defender can be placed on the LOS not threatening anyone; the first 3 placed must threaten the hiker and any two players within 2 spaces of the hiker (either side).
- Hike: automatic, no check; ball moves straight backward to the receiving player directly behind, up to the hiker's skill rating squares; cannot pass through/over a player.
- Calling a play: choose 5 cards from bench, single face-down stack; order fixed (top = first activated). Delay of game: if <5 when time expires, opponent randomly adds bench cards to 5; if >5, opponent removes any except the top card (to discard).
- Motion (offense): any non-LOS player may move to any legal formation position within his move allowance; entering a LOS square ends his motion; must still have a hike receiver.
- After the snap, each round: both flip top play card. Compare skill ratings; defense may read-and-react; higher skill rating decides who goes first; tie -> each rolls a d6, higher decides; tie again -> offense decides. Activated player options: perform an action; move up to half move allowance (rounded up) and perform an action; move and perform action(s) that can be taken as part of a move action; or do nothing. Then card to discard, resolve generated activations; other coach activates his face-up player; then flip next pair until all 5 initial cards done. (Rulebook p.4: full activation = a full move, OR a basic/special action, OR a half-move (rounded up) followed by an action.)
- After the 5 play cards are used: (pocket passer trigger) - continuation rules are on text pages not in this set; loose airborne ball stays until caught or both benches exhausted (p.9).
- **Read-and-react**: after both flip but before deciding who acts first, defense may place its face-up card on discard and replace it with any player currently on its bench (placed horizontally in front of coach, face down, number hidden). Offense may then read-and-react only if defense did (or with QB Read). Then reveal & compare. The read-and-react player: may take an action; may take a full move action; may make an adjustment; may NOT do half move + action. A read-and-react player can't be used for another read-and-react. May perform actions that say "as part of a move action".
- **Adjustment**: once per play/per down per coach, when about to activate the face-up player, declare an adjustment: that player AND any other player on his team each move up to half their movement (rounded up). Neither may begin in possession of the ball. No skill-check actions during an adjustment, but may hand-off, attempt to catch an airborne pass, or try to pick up a loose ball. Any order.
- **Defensive pressure**: if a defender moves into a square threatening an offensive ball carrier behind the LOS, offense discards 2 bench cards chosen at random by the defense; if fewer than 2 cards on bench, ball carrier is automatically tackled. Applies even if the ball previously passed the LOS and came back.

### 3.7 Actions (QRS p.4, rulebook pp.5-8)
Basic actions: MOVE, MOVE AND X (half move rounded up then another action), BLOCK, TACKLE, PASS, HAND-OFF. Plus grab loose ball, stand up, dirty hit (Inferno).
- **BLOCK**: compare skill ratings; if blocker's rating is LOWER, +1 per point of difference (max +3); if HIGHER, -1 per point (max -3); add teamwork/skill/perk bonuses & penalties; 2d6. Success: target pushed (back one square away from blocker - exact push-location rules are on rulebook p.6 text page) and blocker may take a free follow-up move into the vacated square (ignores threat movement penalties; optional). Critical success: target pushed AND knocked down; if he had the ball, fumble (scatter from his location). Failure: target may reverse the block onto the blocker; plus a free activation by ANY opposing player (incl. the one that reversed). Critical failure: blocker pushed back AND knocked down; fumble+scatter if carrying.
- **TACKLE**: tackler must threaten the ball carrier. Lower rated tackler +difference (max +3), higher -difference (max -3); teamwork etc.; 2d6. Success: ball carrier knocked down, down over, play stopped; next LOS at tackle yard line; if 4th down, drive ends, tackling team now on offense. Critical success: also fumbled - scatter from location. Failure: activation for ANY opposing player as normal. Critical failure: tackler knocked down.
- **PASS**: target a teammate or an unoccupied square (not a knocked-down player). Any number of passes anywhere in range until a forward pass has been made or the ball passed the LOS; afterward only lateral/backward passes (target not closer to opponent's end zone than thrower). Max range = 2 x skill rating (Fire Bomb 3x). Distance = squares to target (excluding thrower's square) +1 for every other diagonal after the first; no penalty for intervening players. Procedure: +1 if distance <= thrower's skill rating; other bonuses (skills, perks, bench boosts); -1 per opposing player threatening the target player/location OR the passer (max -3); 2d6. Based on passer's skill rating only (not receiver's) unless special rule. Success: to player -> caught automatically, play proceeds; to open square -> ball in flight on an arc, place red target marker at target (airborne loose ball). Failure: off target, scatter from target location. A pass scattering out of bounds ends the play (incomplete; ball back to LOS; if 4th down opponent takes possession).
- **HAND-OFF**: give/take ball to/from adjacent teammate; may be done as part of a move action, initiated by either the carrier or a non-carrier (who can move adjacent, take it and continue moving). If neither is threatened: automatic. If either is threatened: sport check; doubles -> action fails, activation ends immediately, ball scattered, play continues. Not a skill check (no free activations either way). Repeatable in an activation.
- **GRAB A LOOSE BALL** (pick-up / catch scattered or airborne ball / interception of tipped pass): performed as part of a move action, resolved by sport check. Failure: turn ends, ball scatters. Airborne loose ball (off-target or not-yet-caught open-square pass) stays in the air at its location until caught or both benches exhausted, then falls incomplete (play ends, LOS unchanged). Ground loose ball (fumble, botched hand-off/pitch) stays until picked up.
- **Scattering**: each coach rolls 1d6; difference = squares scattered; coach whose die is higher resolves (chooses path). Path must if possible: not move through same square twice; not end on the player who missed/fumbled (rulebook: not end on starting square); move exactly the difference; not enter a player's square except last square; not go out of bounds unless a pass (fumbles don't go out). May stop short / land on a player if forced. Equal dice: no scatter ("dramatic recovery").
- **KICK / FIELD GOAL**: only in PRO and ALL PRO modes (see section 4). No punts mentioned.

## 4. Rulebook image-page rules (15-21)

### 4.1 Modes
- TECHNO (basic 7v7, no skills implied) and ALL TECHNO (with skills) - defined elsewhere; recommended to play several basic 7-vs-7 games first.
- **PRO** = 8-vs-8 without skills; **ALL PRO** = 8-vs-8 with skills (adds #51 back). Both add the field goal option.
- **INFERNO**: add-on to ALL TECHNO (also works with ALL PRO).
- Optional PRO house rule (tie-breaks for who decides who goes first): use the secondary jersey digit for normal players (higher wins presumably - text says "use the secondary numbers ... to break ties"). Impact/star/superstar players don't use secondary digit; they automatically beat all normal players with the same first digit. Among elites with same rating: superstar > star > impact. Same rating and same star power: roll dice as normal.

### 4.2 Field goal (p.20-21)
- Anytime a coach could run a play, he may kick a FG instead if in opponent's territory (past the 50, closer to the opponent's end zone). No formations are set up.
- Distance = from the square where the hiker would normally be to the imaginary square off the board directly through the middle of the goal posts, measured normally (diagonal penalty), PLUS 1 for the ball passing through the posts. Example: ball on opponent's 40 (kicking from the 45-yard square) -> 11 + 1 = 12.
- Roll 3d6 total. >= distance: good, 3 points; opponent starts with the ball on their own 20. < distance: failure; opponent gets the ball on the yard line the kick occurred from, going the opposite direction (example: hiking from the 35-yard square marked).
- After any FG attempt place a single time token on the scoreboard clock (same as a pass play).
- Note on board scale: board squares appear to be 5 yards each (40-yard line -> the "45 yard square"; spot after miss "40 yard line ... hiking from the 35 yard square"). FLAG.

### 4.3 INFERNO (rulebook pp.19-20, QRS p.2 is the same text)
- **Fire tokens**: a coach may have max 3 fire tokens in his play area at any time and max 3 players on fire at any time.
- **Earning** (tokens go to coach's play area; respect cap of 3):
  - Normal actions: +1 token for EACH of: tackling a player behind the LOS; scoring a safety (tackling a player in his own end zone); grabbing a loose ball (incl. catching a pass thrown to an open square, intercepting, recovering a fumble); causing a fumble; knocking a player down (not via tackle; includes passive abilities like stiff arm).
  - Early celebration: if the ball carrier has enough movement to reach the end zone and score but chooses not to on that activation: +1 token.
  - Showboating: before an action, owning coach may add an extra penalty to the check (may not push it beyond the -3 max). If the action succeeds, coach gains tokens equal to the added penalty (1:1). Example: already -1, increased to -3 -> 2 tokens on success.
  - Dirty hit: an ACTION targeting a knocked-down opponent. Automatically +1 vs a downed opponent; it's a power/strength move with normal bonuses/penalties including teamwork (e.g. #6 dirty-hitting #5: -1 skill comparison +1 knocked-down = 0). Success -> 1 token; critical success (success + doubles) -> 3 tokens. (No other stated effect of a dirty hit.)
  - Dogpile: if a tackle is a total success, the free activation may be used for a dirty hit on any knocked-down opposing player (incl. the one just tackled), even though the play would normally end after a tackle; if that dirty hit is a total success, another player may dirty hit, and so on.
- **Spending**:
  - **ON FIRE!**: any time before the ball is hiked or after a play has ended, spend 3 tokens (returned to common pile) to place a player ON FIRE (a fire token is placed on him). On-fire player: +3 bonus on all skill checks he makes (still subject to the +3 cap). Remains on fire until he: is tackled behind the LOS; is knocked down (not including being tackled); fumbles the ball (QRS: "fumbles the ball on a hand-off"); runs out of bounds on purpose; fails a skill check; throws an interception.
  - **Bonuses/penalties**: spend tokens 1:1 for +1 / -1 on a skill check. If both coaches want to spend, the coach performing the check must allocate first. Cannot exceed +3/-3.
  - **Movement**: 1 token = +1 movement (1:1). Purchased movement does NOT count toward computing half moves (e.g. #77 half move 4 +3 tokens = 7 then action); also usable in adjustments on one or both players.
  - **Hurdle**: 1 token lets a player move through a knocked-down player's square (in addition to bought movement).
  - **EN FUEGO**: when activating a player, spend 3 tokens to grant that player any single skill in the game; lasts until that coach performs an action with another player (flipping another player and "doing nothing" counts as an action - moving zero spaces).
  - **Sizzle actions** (3 tokens each):
    - FIRE BOMB: a pass with max range 3 x skill rating instead of 2x (#7 -> 21).
    - BRING THE HEAT: usable when the player performs a block, shove, juke, or shake. Add a playmaker die to the check. If the check is a success (partial or total) and the playmaker die matches either skill die, the target is knocked down. If it matches both skill dice on a success: critical success - owning coach chooses either to place the acting player ON FIRE immediately OR gain 3 fire tokens immediately.
- Firestarter: Inferno recommended for players who know all rules/skills.

### 4.4 Other p.21 content
- Solo play: offense normal; defense: shuffle defensive cards, randomly build a play without looking; play normally; don't look at the bench except to read-and-react/bench boost (then flip bench to see cards & pull, not knowing order); reshuffle bench after; if play cards run out, pull from bench as normal and you may look at the defense bench for that portion of the down.
- 4-player variants: each player is offensive or defensive coordinator for a team; COACH MODE: two coaches set formations and call plays, two players run them without being told the plan (hints via card orientation allowed).

## 5. Ambiguities / unreadable

1. BANDITOS #44 Santiago Marron's skills print as "SHOVE STIFF, ARM" (misplaced comma). Interpreted as SHOVE, STIFF ARM (2 squares = star = 2 abilities, consistent with cap).
2. Team guide gives NO explicit skill or move numbers; derived from rulebook (skill = first jersey digit, move = skill).
3. "SPIN" in guide normalized to "SPIN MOVE".
4. Passive playmaker "negates the result on that particular skill die" - what value replaces the negated die is not stated (assume 0). If the playmaker matches both dice, both are negated (=> almost certain failure).
5. Block/juke push direction & exact pushback squares are on rulebook p.6 (text page, not in this image set) - QRS only says "pushed back".
6. QRS lists "Fumbles the ball on a hand-off" as an ON FIRE end condition; rulebook p.19 says "Fumbles the ball" (any fumble). Rulebook likely authoritative.
7. Rulebook p.4 vs QRS: total success grants "full activation" for another own player; ON FIRE +3 interacts with the Rule of 3 cap (so an on-fire player gains nothing from other bonuses).
8. Zone Defender + Interceptor interaction (whether zone threat counts as "threatening the target" for Interceptor) - implied yes (Earl Red / Rex Surewin have both), not explicit.
9. Pocket Passer: "after the last of the five cards from the initial play call have been placed on the discard pile, the next pass on that down" - i.e., only passes made after all 5 play cards are used qualify. Literal reading kept.
10. Option sport check: whether a failed option sport check means the pitch fails (fumble/scatter) or the option simply isn't used is not explicit; the pitch itself also needs a sport check if threatened (hand-off rules).
11. Interceptor's "sport check to see if the interception is a success" - failure consequence unstated (presumably ball scatters from him per sport check failure).
12. Reapers alternate #4 John McFadden replaces #44 Howie Short (different number, same skill 4); the guide doesn't explicitly say which card he replaces, inferred by slot (impact for impact).
13. Field-goal "distance" scale: squares vs yards. Example: kicking square marked at 45-yard line, distance 11 to the post square + 1 = 12 -> implies squares, ~5 yards per square plus end zone squares.
14. PRO house rule tie-breaker: text says use secondary numbers to break ties; doesn't explicitly say higher secondary digit wins (assume higher).
15. Dirty hit has no stated physical effect beyond earning tokens; failure presumably follows normal skill-check failure (opponent full activation).
16. Base TECHNO 7v7 - which player is removed is implied (#51) by "PRO ... add player #51 back onto the roster".
