# MOONMIRE — Legend of the Moonmire

ภาษาไทย: [README.th.md](README.th.md)

A **first-person open-world dark fantasy** adventure (inspired by The Witcher / Red Dead Redemption),
in a **PS2-era 3D** look: a night world under blue moonlight, glowing water, moss-covered ruins, heavy rain and strange creatures.

It is a **desktop app (Windows and Linux)**. Run it and play. No browser, nothing else to install.
All graphics, sound and models are made in code. There are no outside asset files, and it plays 100% offline.

**Languages:** the game is in English and Thai. Switch on the title screen, or in the pause menu under Settings › Language. The first launch follows your system language.

## Download / Platforms

Every push builds the game with GitHub Actions (`.github/workflows/build.yml`). Releases are tagged `vX.Y.Z-build.N`.

- **Windows 10/11:** the portable `.exe` or the installer (details below).
- **Linux — Arch Linux / Manjaro / EndeavourOS:** download the `PKGBUILD` from the release into an empty folder and run `makepkg -si`. It installs to `/opt/moonmire`, adds a menu entry and the `moonmire` command.
- **Linux — any distro, AppImage:** `chmod +x` the `.AppImage`, then run it. It needs `fuse2` (on Arch: `sudo pacman -S fuse2`).
- **Linux — any distro, tar.gz:** extract it and run `./moonmire`.

Local builds: `npm run dist` (Windows) and `npm run dist:linux` (Linux AppImage + tar.gz).

## Download and play (Windows 10/11)

1. Go to the **Releases** page of this repo (right side of the GitHub page) and pick the latest version.
2. Download one of these files:
   - **`Moonmire-Portable-x.x.x.exe`**: no install. Double-click and play.
   - **`Moonmire-Setup-x.x.x.exe`**: an installer. It adds a desktop icon and a Start menu entry.
3. The first time, you may see **"Windows protected your PC"** (the file has no digital signature yet). Click **More info**, then **Run anyway**.

The `.exe` files are built automatically by GitHub Actions (`.github/workflows/build.yml`) on a Windows machine every time game code is pushed.
If a build is not in Releases yet, you can also find it under **Actions → Build Windows and Linux apps → Artifacts**.

**Desktop-only keys:** `F11` or `Alt+Enter` toggles fullscreen · there is a "Quit" button on the title screen and in the pause menu.
The game saves on your computer automatically.

## For developers

Run from source as a desktop app (needs [Node.js](https://nodejs.org) 20 or later):

```bash
npm install
npm start          # open the game in an app window (Electron)
npm run dist       # build the .exe yourself on Windows (files go to dist/)
npm run dist:linux # build the Linux AppImage + tar.gz (files go to dist/)
```

The game itself is plain HTML/JavaScript (Three.js). `electron/` is only a wrapper that turns it into an app, so it still runs in a browser too:
on Windows, double-click `play.bat` (a PowerShell server), or use `py -m http.server 8000` and open http://localhost:8000
The web version is for quick tests and for playing on phones through GitHub Pages (hold the phone sideways).

## Controls

**The menus** use a black-and-gold Gothic theme: the title screen, Choose Your Path, the pause menu, How to Play, the chapter-end screen and the loading screen · `↑ ↓` + `Enter` works on every screen · **Choose Your Path** shows a 3D model of the path turning in the middle of the screen. It loops through light attack, heavy attack and block. Drag the mouse to turn it yourself.

**Controllers (Xbox / PlayStation / generic)** work as soon as you plug them in. No setup: left stick move · right stick look · `A` jump · `B` dodge · `X` talk/pick up · `Y` drink a draught · `RT` attack (hold = heavy attack) · `LT` block/parry · hold `LB` (or press `L3`) sprint · `RB` skill · D-pad up map / down cockroach / left skill tree / right bag · `Start` pause · in every menu: left stick moves the cursor, `A` selects, `B` goes back, `LB`/`RB` change settings, right stick scrolls · touch the keyboard or move the mouse at any time to switch back at once · a picture of the controller with every button explained is under **How to Play** on the title screen, or in the pause menu (🎮 Controller tab)

A new game (story mode) starts with **First Steps, a 13-step tutorial** in the top-left corner. It teaches one button at a time and waits until you really try it (look, walk, sprint, jump, light attack, heavy attack, block, dodge, skill, bag, map, skill tree, ride the cockroach) · `Enter` skips a step · `Backspace` skips them all · the pause menu (`Esc`) has an **all controls** page and a **Repeat the First Steps** button

| PC | Phone | Action |
|---|---|---|
| `W A S D` | left stick | Walk |
| Mouse | drag on the right side | Look around |
| `Shift` | `»` | Sprint (uses stamina) |
| `Space` | `⤒` | Jump |
| Left click | tap `⚔` | Light attack |
| Hold left click, then release | hold `⚔` | Heavy attack (×3 damage) |
| Hold right click, or `R` | hold `🛡` | Block (just as an enemy strikes = **parry**) |
| `C` or `Ctrl` | `↯` | Dodge (you can't be hit during the dodge) |
| `G` | `✦` | Path skill (see Paths) |
| `E` | `✋` | Talk / pick up / open a chest |
| `I` or `Tab` | `🎒` | Open the bag |
| `Q` | `⚱` | Drink a Healing Draught |
| `M` / `Tab` | `⌖` | Map |
| `Esc` | `❚❚` | Pause / settings |
| `F11` | | Fullscreen (desktop version) |

## The in-game screen (Doom style)

A stone bar sits at the bottom of the screen, with the 3D view above it, like in Doom:

| Slot | Shows |
|---|---|
| Weapon | The sword you hold and its attack power (the Sword of the Stone King glows blue) |
| Health | A red number |
| **The face** | Glances left and right · gets bloodier as health drops · turns toward the enemy when hit · screams when hit hard · grits its teeth when attacking · grins cruelly when you kill an enemy or parry · pants and sweats when tired · dead = crossed-out eyes |
| Stamina (tiredness) | Gold stamina; turns orange when low; flashes when empty |
| Items | Number of draughts and coins |

## Sound and music

The music is **composed live in code while you play** (all synth, no music files) and adapts to what is happening:

| Situation | Music |
|---|---|
| Night | Chilling choir, harp and distant bells over a low drone (sometimes it fades down to just the drone) |
| Gloomy day | A mournful cello with lute, melody Dm–C–B♭–A; a flute answers on some passes |
| Near a giant structure | A deep low choir that swells as you come closer (the floating castle, the Stone King, the Beast's Ribcage) |
| Combat | Driving strings and war drums; the more enemies or the lower your health, the more horns and choir join · after a win it slowly fades back |
| The Stone Knight (boss) | A choir singing the *Dies irae* hymn, heavy drums, gongs |
| In the inn | A 6/8 jig on hurdy-gurdy, flute and hand drum (outside you hear it muffled through the walls) |
| Death / boss defeated | A funeral gong / a choir on a D major chord |

When you open the bag or a menu, or pause, the music gets quieter and muffled.

**Sound effects** are 3D (you can hear if an enemy is left/right, near/far) and echo to suit the place (indoors, gorges, temples):

- Footsteps change with the ground: grass, water, wood (in the inn), stone
- Swords sound different hitting flesh / stone / straw / spirits; parries ring out; block, dodge and heavy-attack charge have their own sounds
- Every enemy type has a cry when it sees you, a warning before it attacks, and its own death sound
- Ambience: the river, the castle waterfall, crackling fires, wind that grows on high ground and in gorges, crickets, marsh frogs, owls, distant howling wolves and screams in the dark (at night), crows and the station bell (by day), creaking castle chains, the Stone King breathing, wind whistling through the Beast's Ribcage, people talking and clinking glasses in the inn

Set **Master volume / Music / Effects** separately in the pause menu (`Esc`).

**Use your own music:** put the files in `audio/bgm/` and edit `audio/bgm/tracks.json`, for example
`{ "night": "night.mp3", "combat": "battle.ogg" }` (valid names: `night`, `day`, `combat`, `boss`, `tavern`, `awe`). Your tracks loop in place of the synthesized music.

Menu music: `audio/menu.mp3`

## Resident Evil 4-style bag

Press `I` or `Tab` to open the bag. The game pauses while it is open. Each item takes up space by its real size: a draught is 1×2 slots, ore 2×1, an idol 2×2. You arrange everything yourself:

- **Drag** an item to move it · press **R / right click / scroll the mouse wheel** while holding it to rotate it
- Drop it on **the same kind of item** = stack them · drop it on **one** other item = swap, so you now hold that one
- **Click** an item = menu: Use / Move / Rotate / Discard · drag it to the "Discard" button = drop it on the ground (you can pick it up again)
- **Auto-sort** packs everything tightly in one click
- If the bag is full when you pick something up, the bag opens by itself with the new item waiting in a side slot. Make room, then drag it in (close the bag and the item stays on the ground)
- The bag starts at 8×5. Buy bigger ones at the inn (10×6 and 12×7)

### Items in the world
- **Enemy drops:** Cursed Straw (Strawmen), Shadow Wolf Fang, Giant Leech Slime, Wisp Essence, Stone Knight's Core + an idol (boss), and sometimes treasure
- **Gathered, and they grow back:** Moon Herb (meadows), Glowcap (Western Woods/marsh), Dark Iron Ore (at the foot of cliffs and in the gorge)
- **14 treasure chests** in ruins and around the giant structures. Each opens once
- **Treasure** (Moonstone, Marsh Pearl, Old Rail Token, Railwayman's Pocket Watch, Silver Candlestick, idols) is for selling

### Brewing · Smithing · Shops
| Where | What |
|---|---|
| **Granny Toad** (cauldron) | Healing Draught · Great Healing Draught · Stamina Tonic (stamina recovers ×2) · Glowing Blade Oil (×1.5 damage) · Cat's-Eye Potion (see at night) |
| **Old Anvil, the smith** (village) | Sword, 4 tiers (+20%/tier) · Cloak, 4 tiers (8% less damage/tier) · Lantern, 3 tiers (brighter and farther) · **forges weapons and armour** (see below) |
| **Tallow** (the inn) | Buy draughts/herbs · buy bigger bags · sell treasure and materials |

Draughts with lasting effects show their time left in the bottom-left corner. Upgrade and draught effects show in the weapon slot of the status bar.

## Paths (classes) — pick one at the start, change it at the inn

Each path has its own weapon and changes how the whole game plays, not just the numbers. The face in the status bar changes with the path too (bell earrings, a leech on the cheek, an undertaker's hat, a candle head), and the smith upgrades that path's weapon.

| Path | Weapon | How it plays |
|---|---|---|
| **Wanderer** | Sword | Balanced; can block/parry · `G` Steady: stamina refills at once (30 s cooldown) |
| **Bellwright** | Bell Hammer | **Hit on the music's drum beat** for up to ×2.4 power (a ring around the crosshair flashes on the beat). Each hit rings a note that climbs the scale and builds **Resonance** · `G` when full: **Great Bell** — enemies within 10 m are thrown back and stunned · `G` when not full: a soft tap; **the echo reveals enemies through walls** for 6 seconds |
| **Leech-Doctor** | Lancet + leeches | **Your blood does not regenerate** · the lower your blood, the harder you hit (up to ×2.4) · light attacks cause bleeding · hold and release = **throw a leech** (costs 4 blood + 1 leech from the bag). The leech drinks from the enemy for 8 seconds, then crawls back to feed you · `G` calls the leeches back at once (tearing out extra blood) · find leeches from Giant Leeches, the inn shop and Granny Toad's cauldron |
| **Coffin-Bearer** | Coffin | Slow but heavy swings; hold = wide ground slam · **raise the coffin as a wall** that stops everything from the front, even ground slams (but it can't parry) · enemies you kill leave a corpse — `G` near a corpse = **take it into the coffin** (4 slots) and gain its power: Gaunt = sprinting costs no stamina, Crawler = climb steep slopes, Weeping Woman = **an enemy you stare at cannot move**, Brute = wider ground slam, wolf = faster swings, Strawman = take less damage · `G` anywhere else = **bury a corpse**; it becomes a grave you respawn at + restores 40 health |
| **Crossbow Hunter** | Crossbow + Hunting Knife | **Ranged attacks** · click = fire 1 bolt, then **reload for 1.2 s** · **hold = zoom and aim**, release for a ×2 shot that **pierces up to 3 enemies** · **headshots** deal ×1.5 · while reloading or out of bolts, click = **knife stab** · `G` **sets a steel jaw trap** (up to 2, 18 s cooldown); an enemy that steps in is stuck for 3 s (bosses only slow down) · **bolts are limited**: you start with 24, buy them at the inn (6 bolts for 10 coins) or have the smith make them (1 ore = 12 bolts, 1 Pale Claw = 4 bolts). Missed bolts stick in the ground and can be picked up; bolts stuck in an enemy are 60% recoverable when it dies |
| **Wick-Bearer** | Censer on a chain | **Your health is candle wax that keeps melting.** Stand near a fire to recast it · long-reach swings set enemies on fire; the longer you keep hitting, the hotter the flame, but you melt faster · hold = spin · **hold right click = shield the flame**: the screen goes dark, enemies can't see you and give up the chase (but you can't block) · `G` **plants a candle** (up to 3). The Pale Ones and spirits can't enter its light. Standing near a candle slowly recasts your wax |

## Weapons and armour

Every path has **4 weapons of its own kind** — the one it starts with, a quick one, a heavy one and a rare one with a power — and **one suit of armour** that any path can wear. Both are bag items: open the bag, click the piece and choose **Equip**; the old one goes back into the bag. Each path keeps its own weapon when you change paths at the inn. Smith upgrades (+1…+4) stay on your hand, so a new weapon never undoes them.

A weapon bends the blows its path already throws: light/heavy damage, swing time (for the crossbow: reload time), stamina per blow, reach, and one effect on each hit — **bleed**, **fire**, **frost** (slows), **drain** (heals you), **concussion** (heavy blows stagger), **precision** (15% chance of ×2), **moonlight** (×1.4 against the Pale Ones).

| Path | Quick (40) | Heavy (90) | Rare (160) |
|---|---|---|---|
| Wanderer (Old Sword) | Marsh Rapier — bleed | Stone Greatsword — concussion, +0.5 m | Moonlight Blade — moonlight |
| Bellwright (Bell Hammer) | Silver Chime Mallet — frost | Tower Clapper — concussion | Funeral Bell — drain |
| Leech-Doctor (Lancet) | Bone Scalpel — precision | Butcher's Cleaver — bleed | Bloodletter's Saw — drain |
| Coffin-Bearer (Pauper's Coffin) | Child's Coffin | Iron Sarcophagus — concussion | Coffin of the Drowned — frost |
| Wick-Bearer (Censer) | Thurible of Ash — precision | Bronze Brazier — fire, +0.4 m | Black Wax Lantern — moonlight |
| Crossbow Hunter (Hunting Crossbow) | Light Crossbow — fast reload | Arbalest — concussion | Moonsilver Crossbow — frost |

| Armour | Effect | Where |
|---|---|---|
| Traveller's Rags | nothing | you start in it |
| Hunter's Leathers | −8% damage, dodge costs −15% | smith · bounty "Brood-Mother" |
| Rusted Mail | −15% damage, a little slower, stamina −10% | smith |
| Pilgrim's Robe | −5% damage, faster healing | smith |
| Briar Coat | −10% damage, returns 30% of melee damage | smith · bounty "Sheep-Devouring Brute" |
| Gravedigger's Shroud | −6% damage, foes notice you 35% closer | chest at the far-west ruin |
| Guard's Plate | −28% damage, never staggered, slower, dodge costs more | the Last Guard |
| Moonlit Raiment | −18% damage, stamina +25%, faster healing | the King of a Hundred Hands |

**Where weapons come from:** the smith forges your path's quick and heavy weapons (coins + materials) · the Stone Knight gives your path's heavy weapon, the King of a Hundred Hands its rare one · Oren drops the Moonsilver Crossbow · bounties "Old Fang" (quick), "Corpse-Eater" (heavy) and "Grey-Haired Widow" (rare) give your path's weapon · chests: Marsh Rapier (north ruin), Bloodletter's Saw (swamp ruin), Funeral Bell (belfry), Black Wax Lantern (standing stones), Coffin of the Drowned (sunken cathedral), Light Crossbow (lost hunter's camp). A piece you already own is never given twice.

## Each path's skill tree (press K)

**Each path levels up on its own.** The top level is **30** and it is hard to reach (about 54,000 XP in all). Each level gives 1 point. Even at level 30 you can't buy the whole tree, so you choose what to focus on.

- **XP comes from:** killing enemies (×1.5 outside the valley) · killing the same kind of enemy again and again gives less and less (down to 20%, recovering in ~1.5 minutes) · bosses and bounty monsters always give full XP · quests 150 · turning in a bounty 300 · **discovering a new place 120**
- **Tree shape:** trunk (everyone on the path) → choose **1 of 2 lines** → each line has **3 branches** you can mix → a **◆ Choose 1 of 2** node → **★ Finishing Art, choose 1 of 2**
- **Permanent locks:** once you put a point in one line, the other line closes for good. The "Choose 1 of 2" nodes work the same way. The game always asks you to confirm first.
- Each skill has a minimum level, and the deeper ones need the **path's keepsake**, earned only by playing that path its own way.
- **Old saves:** all the XP you ever earned goes to the path you are playing (counted by the new rules), and all your points are refunded once so you can choose again.
- **Online mode:** everyone starts again at level 1 every match. Levelling is fast, the cap is level 15, and the same tree and line locks apply.

Every path has a full tree of **32 skills** (trunk 4 + 14 per line):

| Path | Keepsake (earned by) | Line 1 (branches · ◆ · ★) | Line 2 (branches · ◆ · ★) |
|---|---|---|---|
| Wanderer | Notched Blade Sigil (parry / kill with a heavy attack) | **Wandering Blade** · Speed / Heavy Attack / Hot Blood · ◆ Twin Shadow Blade / Heavy Hand · ★ Crescent Blade / Whirling Blade | **Survivor** · Parry / Endurance / Recovery · ◆ Guarded Stance / Light Feet · ★ Riposte / One-Man Bulwark (block from every side) |
| Bellwright | Cracked Bell Shard (hit on the beat) | **Rhythm** · Climb the Scale / Keeping Time / Sharp Tone · ◆ Duet / Accelerando · ★ Bell Symphony / Finale | **Great Bell** · Wave / Echo / Hammer · ◆ Giant Bell / Veil of Sound · ★ Tolling / Death Knell |
| Leech-Doctor | Sated Leech (blood the leeches bring back) | **Leech Brood** · Swarm / Faithful / Venom · ◆ Leech Queen / Feast · ★ Bursting Leech / Leech Tide | **Surgeon's Knife** · Wounds / Frenzy / Drain · ◆ Rapid Slashes / Precision · ★ Cold Dissection / Exsanguinate |
| Coffin-Bearer | Grave Soil (coffin blocks / gathering corpses / burying corpses) | **Iron Wall** · Guard / Retaliation / Ground Slam · ◆ Moving Keep / Bastion · ★ Coffin Charge / Iron Coffin Spin | **Corpse-Raiser** · Gathering / Burial / Raising · ◆ Ossuary / Lone Soul · ★ The Restless Dead / Legion in the Coffin |
| Crossbow Hunter | Bolt Fletching (headshots / kills with aimed shots) | **Marksman** · Aim / Reload / Lurk · ◆ Heavy Iron Bolt / Twin-String Crossbow · ★ Moonpiercer / Bolt Volley | **Trapper** · Traps / Instinct / Knife · ◆ Powder Trap / Net · ★ Field of Traps / Hunter's Feast |
| Wick-Bearer | Black Tallow (hits while the flame is hot / ambushes) | **Flame** · Stoke the Fire / Spreading Fire / Wax · ◆ Great Censer / Flare · ★ Firestorm / Dying Sun | **Shadow** · Stalk / Candles / Ambush · ◆ Frugal Candle / Cat's Eye · ★ Ambush Burn / Eclipse |

See every skill in the game (press K) or in `src/upgrades.js`.

## Mount: the Giant Cockroach (press H)

Works in both story mode and online mode.

- **H to whistle:** the Giant Cockroach runs up from behind you. Press **H** next to it to mount; press again to get off.
- **Riding:** runs at 12.5 m/s (sprinting on foot is 8.2), costs no stamina, and climbs slopes you can't walk up.
- **Space:** spread its wings and flap upward. Hold to glide (wing power is limited and recovers on the ground).
- **Right click:** make it bite the enemy in front (while riding you can't block or dodge).
- **You can attack from its back as usual**, but a hard hit knocks you off.
- **Online:** other players see you riding the cockroach.

## War of the Moon Kings — online mode, 2–4 players

A MOBA mix on **its own battlefield map**: each player has their **own base and king** (four bases in the four corners: Red, Blue, Green, Gold). **The last king standing wins.** Empty seats can be filled with **lord bots** (you can also play alone against 3 bots).

**The battlefield map** (`src/arena.js`): a wide forest basin ringed by mountains
- **8 dirt roads, lit by lanterns all the way**: a ring road links neighbouring bases, and a road from every base runs straight into the **Court of the Kneeling King** in the middle of the map (a giant statue of a king kneeling on his sword)
- **Signposts** (glowing letters in that base's colour) at every road out of a base and every road out of the Court. Just follow the roads to reach any base.
- **The `M` map** shows every road. The four bases are circles in their colour (yours has a ring around it). All place names show from the start · **the compass** has a pin in each base's colour (⌂ = your base, ✝ = a fallen base) with the distance
- **4 wild camps** between the roads (Northern/Southern Wolf Den, Eastern/Western Chapel Ruin) and wild beasts roaming the forest. Each kill gives 2 souls; they respawn every 75 seconds
- **Starting buildings** at every base: 2 Arrow Towers (between the road to the Court and the ring road, covering all three ways), 1 Healing Campfire and 1 mine

**To play:** title screen → `War of the Moon Kings (online)` → enter a name, choose a path →
- **Create a Room** to get a 5-letter code. Send it to your friends, then press *Add Bot* / *Start*
- **Join**: type your friend's room code

It connects peer-to-peer (WebRTC) through PeerJS's public matchmaking server. Every machine needs internet. The host runs the game (if the host leaves, the game ends; if anyone else leaves, a bot takes over their base) · this mode doesn't touch your story save

**Resources:** 🪵 wood (chop logs with `E`) · ⛏ ore (break rocks) · ✦ souls (kill wild beasts, creeps or other players) · mines keep producing wood and ore

**`B` = Your Camp** (phone: the 🏰 button). You can only build inside the coloured ring around your base — left click to place · right click to cancel · `T` to rotate

| Building | What it does |
|---|---|
| Arrow Tower | Shoots enemy creeps and players within 24 m |
| Healing Campfire | Heals you and your creeps within 9 m |
| Mine and Sawmill | +4 wood +2 ore every 8 seconds |
| Wooden Wall | Blocks enemy creeps (your creeps can pass) |
| Spike Trap | Stabs enemies who step on it, 4 times |
| Straw Decoy | Enemy creeps attack the decoy first |
| Warning Bell Tower | Rings a warning when enemies enter your base |
| Brute Brood-Nest | Unlocks Brutes, and all your creeps get +25% health |

**Summon creeps** (choose the base to attack): Gaunt ×3 · Crawler ×3 · Shadow Wolf ×2 · Brute ×1 — creeps follow the roads: to a neighbouring base along the ring road, to the opposite base through the Court (around the statue). They fight creeps, towers and players, and attack the king (the king fights back). If their target is knocked out, they find a new one.

**Heroes:** other players see you as the hero of your path (Wanderer, Bellwright, Leech-Doctor, Coffin-Bearer, Wick-Bearer, following the designs in `docs/hero-concepts/`). Their cloth is dyed in the base colour, they carry a light so you can see them at night, and you see each other walk, run, light attack, heavy attack and block · **the Coffin-Bearer** uses a model of a man in a long coat with an iron cage over his head and a lit candle on top. He carries the coffin at his side, with a strap, belt and armband in the base colour · **the Wanderer** uses a model of a knight in old iron armour in Dark Souls style, holding a longsword, with a moon lantern on the hip, a tabard and armbands in the base colour · **the Leech-Doctor** uses a model of a detective in a long coat and wide-brimmed hat, wearing a gas mask, with a bandolier of glowing red leech jars across the chest, holding a lancet, with a scarf and armband in the base colour (the .fbx file came with no textures, so it is coloured by body part instead)

**Lord bots** also have a hero walking the field (a random path no one else is using): it guards the front of its throne, chases enemies who come close to its king, follows its own creeps to attack the target base, falls back when its health is low, attacks creeps, heroes, buildings and kings, and can be hit. Killing it gives 3 souls. It respawns at its base after 12 seconds.

**Combat:** you use your path and weapon as usual. You can attack other players, buildings and kings. When you die you respawn at your base after 6 seconds (if your king still stands). Killing another player gives 3 souls.

## Bounty board (Witcher style)

The board outside the inn has 3 contracts a day (new ones every morning). You can take 2 at once.

1. **Take a contract** at the board and read the client's story.
2. **Go to the scene** by the compass (orange-red pin) and **examine 3 signs** (bloodstains, footprints, scraps of cloth/bone, all faintly glowing). Each one tells more of the story — the last one shows **the lair and the weak point**.
3. **Hunt** the named monster at its lair (big, lots of health, with a health bar showing its name in the fight). Each one has a **special trait** you must play around:
   - **Regrowth** — its wounds close, unless it is burning or bleeding (Wick-Bearer, Leech-Doctor, blade oil)
   - **Shroud** — invisible beyond ~6 steps (the Bellwright's echo or a Cat's-Eye Potion reveals it)
   - **Brood** — keeps calling Crawlers to help
   - **Frenzy** — below half health it gets much faster and stronger
   - **Stoneskin** — light attacks barely hurt it; you need heavy attacks (the Coffin-Bearer's coffin always gets through)
4. The kill gives you a **Proof of the Hunt**. Bring it to the board for coins and rewards.

There are 8 written contracts (Brood-Mother Beneath the Ribs, Old Fang, Faceless Effigy of the North Field, Leech Beneath the Sunken Bell, Corpse-Eater of the Gorge, Shadow at the Bedside, Sheep-Devouring Brute, Grey-Haired Widow). Once you finish them all, the board keeps rolling new random contracts.

## Random world events

The world changes over time on its own. Events roll at every dusk, every dawn and every hour of the night (sleeping at the inn rolls too). A large banner in the middle of the screen tells you when one happens, and a status tag shows in the bottom-left corner.

| Event | When | Effect |
|---|---|---|
| **Night of the Blood Moon** | Some nights (~28% from night 2) | The sky, fog and water turn blood red. The music becomes a dissonant choir over a heartbeat; crickets and frogs fall silent; screams come more often · the Pale Ones hit 30% harder, move 20% faster, see you from farther away and respawn quickly · 10 more Pale Ones appear across the map · **drops ×2**, and the Pale Ones drop **Blood Amber** (treasure) |
| **Wandering Pedlar** | Some mornings (~40%) | Sets up a stall at a crossroads/railway for 1 day, with a bell sound and a compass pin · sells rare goods in limited numbers (Great Healing Draught, blade oil, Stone Knight's Core, etc.) · **Treasure Map** pointing to a chest you haven't opened · buys treasure for ×1.3 the inn's price · has rumours to share |
| **Heavy Fog** | Some mornings/evenings | You can see only a short way, but enemies see you at only half range — a chance to sneak through the woods |
| **Falling Star** | At night (rolled every hour) | A star falls not far away. You can see its beam from far off, and it gets a compass pin. Go pick up the **Star Shard** (valuable treasure) before the light fades |

## Combat

- **Stamina (yellow bar):** used for attacking, dodging, sprinting and blocking hits. It recovers when you stop. If it runs out, you can't sprint until it is back to 35%.
- **Light attacks** are fast, cost little stamina, make enemies flinch and can interrupt their attacks.
- **Heavy attacks**: hold until you see the sword wind up. They deal ×3 damage, knock enemies back, and the game freezes for a split second so you feel the weight.
- **Block:** you take only 12% damage but lose stamina. If stamina runs out, your guard breaks and you stagger.
- **Parry:** raise your guard within 0.3 seconds before a hit lands. You lose no health, get stamina back, and the enemy staggers for a long time (your chance to counter).
- **Dodge:** dash in the direction you are holding (with no direction, you step back). You can't be hit during the dodge.
- Every enemy **signals before it attacks** with a wind-up and a warning sound. Watch the timing, then dodge or parry.

### Enemies

| Enemy | Where / when | What it does |
|---|---|---|
| Marsh Wisp | Marsh, gorge, temple · night | Floats after you and rams you |
| **Mad Strawman** | Fields around Moon Hill · **day** (at night it stands still on its pole) | Hops after you and swings its arms |
| **Shadow Wolf** | Western Woods · any time, in packs | Runs fast and lunges to bite |
| **Giant Leech** | In the marsh water · night | Rises from the water, rears up and strikes; never comes on land |
| **Gaunt** | Across the map · night (some stay in the Western Woods even by day) | A thin, pale, hunched body with long grey hair. It drags its legs slowly but **charges when close**, raises its arms high and claws |
| **Crawler** | Marsh and forest edges · night | Crawls on all fours like a spider, very fast, and pounces |
| **Weeping Woman** | Under the Beast's Ribcage, ruins, the temple · night | **Moves only when you are not looking at her.** Turn your back and she rushes in silently; you hear her sobbing come closer and closer. Hits very hard |
| **the Lost** | Along roads outside the valley, ruins, the bell tower graveyard, the Hanging Tree, abandoned farms · any time | Travellers who came to the Moonmire before you and got lost here. Naked, charred bodies with eyes like red embers. They still **fight like people**: up close they **raise their guard**; a light attack from the front gets parried and countered at once · **two-punch combos** · sometimes they **sidestep** as you start to attack — answer: **a heavy attack breaks the guard** (1 s stagger), circle round to the side/back, or hit them just after they punch · drop Old Rail Tokens, Moon Herb, draughts |
| **Empty Armour** | Bell tower, Standing Stones, windmill, sunken cathedral, Hanging Tree, the northern road, the castle lakeshore, the temple court · any time (high-level enemy) | An empty suit of iron armour that still walks its watch, with a two-handed sword and a cold light behind its visor. Slow, but hits hard · **light attacks barely hurt it** (only 1 in 3 lands, and it doesn't flinch) · **heavy attacks** land in full and stagger it · **parry its sword = a 1.6 s opening with ×2 damage** · every 3rd swing it raises the sword in both hands and slams the ground around it (can't be parried — dodge) · drops Dark Iron Ore, blade oil, sometimes a Silver Candlestick |
| **Gaunt Giant** | Castle lakeshore, eastern ruins, gorge mouth · any time | 3 metres tall, slow but heavy; every 2nd attack is a ground slam (can't be parried — dodge) |
| **Stone Knight of the Bridge** (boss) | The bridge before the Stone King | A giant stone sword; every 3rd attack is a ground slam (can't be parried — dodge clear) · beat it to get the **Sword of the Stone King**, ×1.6 attack power |

Dead enemies respawn after a while (except bosses). If you die or sleep, enemies stop chasing and return to their spots.

## Boss: the King of a Hundred Hands (the Hanging Tree, Western Darkwood)

A body about **10 metres** tall in a rotting royal cloak, a human face under a crown of thorns, and **dozens of arms growing from its chest**. It crouches among the roots of the Hanging Tree; the cocoons hanging from the branches are people it has caught. Come close (~26 m) or hit it → it rises and roars, the screen shakes, and the boss health bar appears.

| Move | Warning | How to avoid it |
|---|---|---|
| **Sweep** | Swings all its arms to one side | Back out of its ~13 m reach, or **roll (C)** through the sweep · you can block, but it costs a lot of stamina |
| **Slam** | Raises all its arms high | Stay out of the impact point in front of it, then **jump or roll over the shockwave** that spreads out in a ring · can't be blocked |
| **Grab** | A red circle appears under your feet; one arm stretches out | **Run out of the red circle** before the hand comes down · if it hits: heavy damage, and you're thrown into the air |
| **Hands from the ground** | Several red circles follow your feet | **Keep running**; a hand bursts up from the circle behind you after ~1 second · can't be blocked |

- **Strike now:** after a slam, or a missed grab, its arms are stuck in the ground for a moment. During this it takes **×1.5** damage ("Strike now!").
- **Second half (below half health):** it roars again, the cocoons burst and **3 Crawlers** drop down, then it attacks faster and more often, with 7 hands bursting from the ground at a time.
- If you run too far from the clearing, it goes back to crouch at the foot of the tree and heals fully.
- **Reward:** Thorn Crown of the Hundred Hands (the most valuable treasure in the game), Great Healing Draught, Star Shard ×2, Moonstone, 120–160 coins and a big chunk of XP · it does not come back once dead (stored in the save)

## Story, Chapter 1 — The Hands That Hold the Moon

You wake in a marsh that has flooded an abandoned railway. Tonight the moon is sick, so its light is a cold, icy blue.

1. **A Crow's Cry in the Field:** follow the railway to meet *Kowak*, a crow-headed shepherd on Moon Hill.
2. **The Lost Black Sheep:** find 3 sheep that wandered into the marsh, the Western Woods and the foot of the gorge.
3. **Granny Toad Beneath the Giant Mushroom:** meet the toad witch in the Western Woods (she also sells draughts).
4. **Lights of the Marsh:** cut down Marsh Wisps (will-o'-the-wisps) to collect 5 Wisp Essences.
5. **The Drowned Temple:** pass through Archway Gorge and pour the moon water on the altar → you see a vision of *a hundred hands gripping the moonlight* and get **finger 1 (the Marsh)**.

After the altar, 3 acts open at once. Play them in any order. Each act gives 1 finger of the King of a Hundred Hands (see your progress under `Q`):

6. **Northern Highlands — The Bell No One Rings:** the bell-ringer's grave (with a lantern) → climb the bell tower and ring the bell → the Standing Stones; fight the Lost who wake up → get **the Finger of Wind** + **the Little Bell** (a special item: ring it and the Lost around you freeze for 4 s; 90 s cooldown; unlimited uses · works on a boss once per fight)
7. **Eastern Farmlands — The Field No One Harvests:** a ghost child named **Min** (seen only by day) in the cornfield → find the missing windmill sail → put the sail back → open the windmill door and take the straw doll that fell from a cocoon → **the Finger of Grain**
8. **Southern Lake — The City Under the Lake:** talk to **the Ferryman** at the Rotting Pier → read the 3 murals in the sunken cathedral → **the Last Guard** (a large Empty Armour) → **the Finger of Water** + the Guard's Sword (take it to the smith to forge into your sword, ×1.25 damage)
9. **Western Darkwood — the Hanging Tree** (opens once you have 3 fingers): the journal at the hunter's camp → fight **Oren the Hunter**, who has become one of the Lost (still wearing his long coat, wide-brimmed hat and iron mask, and holding a skinning knife) → the King of a Hundred Hands wakes
10. **The King of a Hundred Hands:** before the time comes, hundreds of roots bind its body and no blade gets through · every finger you collected weakens the boss (Grain: it calls 1 Crawler instead of 3 · Wind: its grab is slower · Water: its shockwave is slower)

Once the boss falls, light from the cocoons rises into the sky → **"Chapter 1 — The Hands That Hold the Moon — The End"** · afterwards the weather calms, and the Stone King's eyes in the western valley begin to glow (setting up Chapter 2) — you can keep exploring the world as usual.
Old saves that finished the earlier story start at the new 3-act part (after the altar).

The game saves automatically (localStorage). Press "Continue" on the title screen to carry on.

## Places in the world (17 to discover)

When you come near a new place, a "Place Discovered" banner appears in the middle of the screen. The map shows names only for places you have found; the rest show as "?".

| Place | What you'll find |
|---|---|
| **Sky-Hung Castle** (south-east) | A Gothic castle on a floating rock island over 200 metres up, chained by 5 giant chains. A waterfall pours into the lake, small rock islets with lanterns float around it, and a pink cosmic whirlpool turns in the sky |
| **The Sleeping Stone King** (west) | A giant crowned stone head about 60 metres tall, half sunk in the ground, with giant hands rising from the earth, a stone bridge over a stream, and braziers |
| **Beast's Ribcage** (marsh) | The skeleton of a giant beast with the railway running through its chest, and a horned skull fallen beside the tracks |
| **Abandoned Station Village** | Wooden houses, a well, lamp posts, and **the Molten Candle Inn**, which you can walk into |
| From the original Chapter 1 | Moonlit Marsh, Moon Hill, Giant Mushroom, Archway Gorge, Drowned Temple |

### The lands beyond the valley — an open world of 1.6 × 1.6 km

The map grew from 640 m to **1,600 m** (about 6 times bigger). The original valley sits in the middle, exactly as before. The outside is split into 4 regions, with **8 dirt roads** leading out of the valley (shown on the `M` map) and roadside shrines with lit candles along the way.

| Region | Place | What you'll find |
|---|---|---|
| **Northern Highlands** (pine forest, strong wind) | **Bell Tower on the Peak** | An 18 m stone tower. **You can climb the spiral stairs inside** up to the bell chamber, which looks out over the whole world, with a treasure chest waiting at the top · a ruined church and graveyard |
| | **Standing Stones of the Cold Wind** | A ring of 13 standing stones (2 have fallen), an altar whose letters still glow, swirling mist |
| **Eastern Farmlands** (dry grassland) | **Abandoned Windmill** | A stone windmill on a hill. **Its sails still turn** (one is missing). A broken cart, sacks of grain |
| | **Abandoned Cornfield** | A roofless farmhouse, a barn with a sagging roof, dry corn rows behind a fence, haystacks, a well — Strawmen stand among the corn |
| **Southern Lake** (waist-deep water) | **Rotting Pier** | A wooden pier reaching into the lake, a lantern at the end, a sunken boat, the ferryman's hut |
| | **Sunken City** | 8 stone towers rising out of the water; some windows glow with a green light that is not candlelight. A roofless cathedral with a 35 m spire · **a half-sunken stone path** leads from the end of the pier to the great tower |
| **Western Darkwood** (steep slopes, thick trees) | **Hanging Tree** | A giant dead tree in a clearing, with silk cocoons wrapping corpses hanging from its branches, and candles that someone still comes to light |
| | **Lost Hunter's Camp** | A tent, a fire still burning, a rack of drying hides, a lean-to of branches |

- **62 enemies in the new lands**: wolf packs on the highlands and in the woods, Gaunts (some in the Darkwood hunt even by day), Crawlers around the Hanging Tree and the lakeshore, Weeping Women at the bell tower, the Standing Stones, the Sunken City and the Hanging Tree, Strawmen in the fields, 4 Gaunt Giants, Marsh Wisps and Giant Leeches in the lake
- **Items in the new lands**: 10 more treasure chests (on the bell tower, in the sunken cathedral, at the foot of the great tower, etc. — with rare items like the Idol of the Stone King, Star Shards and the Old Portrait Locket), 26 more herb spots (north/east), 24 Glowcap spots (west/south), 12 ore veins on the highlands
- **Long journeys**: ride the **Giant Cockroach (H)** to run fast and glide across — crossing the world from north to south takes about 2 minutes on its back
- Behind the scenes: the ground is split into 100 chunks that hide when far away, plants are grouped in 200 m cells that hide by distance, and far-off enemies stop thinking. This makes the world bigger while keeping the frame rate close to before.

### Animals in the world
- **13 pigs**: 4 in the pig pen in the middle of the village (between the two houses to the north; the pen gate opens onto the road), 7 rooting around the abandoned farms in the east, 2 beside the ferryman's hut at the Rotting Pier
- They nose at the dirt, waddle about, oink when you are near, and step aside when you bump into them
- **Run at them, ride the cockroach into them or swing a sword at them** → the pig squeals and scatters (they can't be killed; they belong to the villagers)

The giant structures use thinner fog than usual, so you can see their looming shapes through the mist from hundreds of metres away (megalophobia).

### The Molten Candle Inn
The owner is **Tallow**, a gentleman in black whose head is a pile of melting candles:
- Drink a Candlelight Ale (3 coins) to restore full health
- Rent a room (5 coins) to skip to morning or evening
- Buy draughts, and ask about the legends of the castle, the Stone King and the giant bones

## Day and night

1 in-game day = 15 real minutes. There is a clock under the compass.

- **Night:** blue moonlight, stars and green northern lights above the northern cliffs. Marsh Wisps come out to hunt.
- **Dawn / dusk:** a rose-purple sky; the whirlpool in the sky is at its clearest.
- **Day (gloomy):** heavy clouds, grey-green fog, washed-out colours. The sun never breaks through. The glowing water fades and the Marsh Wisps disappear.

## How the PS2 look works

`src/ps2.js` is the heart of the look:

- **Low internal resolution** (448 lines by default, the same as PS2 NTSC), then scaled up with nearest-neighbor so the pixels show clearly
- **Vertex snapping** rounds vertex positions to the pixel grid, so the world "wobbles" a little like consoles of that era
- **Fake bloom** takes the bright parts, blurs them and adds them back, the same way PS2 games used a framebuffer blur for "glow"
- **Moonlight color grade** lifts the shadows to navy, boosts saturation and pushes the highlights cooler
- **Ordered dithering + reduced color depth** gives banding and dither patterns like 16-bit mode
- **Blue exponential fog** hides the draw distance (a classic resource-saving trick)
- **32–128px textures**, all drawn in code (`src/textures.js`)
- **Foliage as crossed alpha cards**, swaying in the wind in the vertex shader
- **Black circle shadows (blob shadows)** instead of real shadows, like PS2-era games

## Project structure

```
electron/           desktop app wrapper (window, fullscreen, quit)
fonts/              Pridi + Cinzel fonts (OFL), bundled for offline play
build/icon.png      app icon
index.html          game page + HUD
play.bat, serve.ps1 Windows launcher (web server in PowerShell)
css/style.css       UI styles (Pridi + Cinzel fonts)
vendor/             three.js r170 (MIT)
src/
  main.js           game loop, game state, combat, save/load
  ps2.js            PS2-style render pipeline + shader patch
  terrain.js        builds the 1.6 km terrain (original valley + 4 outer regions, roads, railway), split into chunks
  layout.js         positions of key places on the map
  environment.js    sky (northern lights, whirlpool, giant moon), glowing water, rain, lightning
  daynight.js       day-night cycle (colour, light, fog by time of day)
  giants.js         floating castle, Stone King, Beast's Ribcage
  village.js        the village and the Molten Candle Inn (with interior)
  builder.js        helper that merges structure meshes
  wilds.js          structures beyond the valley: bell tower (climbable), standing stones, windmill, abandoned farm, pier, Sunken City, Hanging Tree, hunter's camp, roadside shrines
  structures.js     railway, station, fences, archways, temple, bridges, ruins, giant mushroom
  vegetation.js     trees, ferns, grass, rocks, glowcaps (instanced)
  characters.js     NPCs, black sheep, every enemy type (wisps, strawmen, wolves, leeches, Stone Knight), sword and lantern in hand
  gaunts.js         the Pale Ones (Gaunt, Crawler, Weeping Woman, Gaunt Giant): real skeletons + poses + skin/hair/face textures
  combat.js         combat system (stamina, light/heavy attacks, block/parry, dodge) + AI for every enemy and boss
  entities.js       sheep flock AI, particles
  hollow.js         the Lost: enemy from a .glb model (walk/run/guard/punch/stagger/fall made in code)
  armour.js         Empty Armour: enemy from a .glb model + two-handed sword (walk/wind-up/swing/stagger/collapse made in code)
  handking.js       the King of a Hundred Hands boss: an 85-bone body, 4 attacks, warning rings on the ground, shockwaves, hands from the ground, and its own brain
  rigpose.js        helper that loads rigged .glb models and poses them from code (used for the Lost and the armour)
  critters.js       animals in the world (pigs: .glb model + walk cycle in code; wander, graze, flee)
  quests.js         quests and dialogue (Thai)
  player.js         first-person movement, collision, stair climbing
  collision.js      2.5D collision (circles + rotatable boxes)
  input.js          keyboard/mouse + touch buttons
  moba.js           War of the Moon Kings: bases, kings, buildings, creeps, bots and sync (the host runs the game)
  (assets/heroes/)  hero models imported from .glb files with tools/import-hero.mjs (currently: Wanderer, Leech-Doctor, Coffin-Bearer — models that already have textures keep their UVs/textures, and arms are lowered from A-pose / T-pose before rigging)
  heroes.js         the 5 path heroes other players see in online mode (16-bone rig, team-coloured cloth, walk/attack/block)
  arena.js          battlefield map: ground, roads + lanterns, signposts, Court of the Kneeling King, wild camps (`?arena`)
  net.js            WebRTC networking through PeerJS (create/join a room with a 5-letter code)
  lobby.js          online lobby screen
  contracts.js      bounty board (board, clues, named monsters + special traits, random contracts)
  events.js         random world events (Blood Moon, pedlar, heavy fog, falling star)
  classes.js        the 5 paths (weapons, moves, skills, special rules) — combat.js asks it for attack values and calls hooks from here
  audio.js          sound engine: sound/music buses, reverb, 3D sound and all sound effects
  music.js          adaptive music (synthesized instruments + a piece for each situation)
  ambience.js       ambient sound by area, time and weather
  ui.js             compass, quests, dialogue, map
  hud.js            Doom-style status bar (face, pixel digits, weapon icon)
  items.js          every item (slot size, stacking, price) + pixel icons
  equipment.js      weapons (4 per path) and armour: stats, effects, equipping
  inventory.js      grid bag logic (place, rotate, stack, auto-sort, save)
  bagui.js          RE4-style bag screen (drag and drop, item menu, waiting slot)
  loot.js           enemy drops, regrowing herbs/mushrooms/ore, treasure chests
  menus.js          cauldron, forge, shop (recipes and prices live here)
docs/GDD.md         game design document + development plan
docs/MODEL_PROMPTS.md  prompts for making character models with AI in a consistent PS2 style + specs for importing into the game
docs/HERO_PROMPTS.md   detailed prompts for the 5 playable path heroes (designed to read clearly in online fights)
docs/model-refs/    reference images of every character, rendered in-game
```

## Play through GitHub Pages

The workflow `.github/workflows/pages.yml` is ready:
go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
After you push to the main branch, you get a link `https://<username>.github.io/<repo name>/` to play on phones.

## Developer parameters

- `?autostart` skip the title screen
- `?at=x,z,yaw,pitch` warp to that position (e.g. `?autostart&at=0,-226,0,0.1` = in front of the temple)
- `?stage=4` start at that quest stage
- `?time=0.5` set the time (0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk)
- `?peer=localhost:9000` use your own PeerJS matchmaking server instead of the public one (e.g. `npx peerjs --port 9000`)
- `?event=bloodmoon` force an event right away (`bloodmoon`, `merchant`, `fog`, `star`)
- `window.__game` in the console gives access to the whole state

## Credits

- **"Giant cockroach"** model by [Drillimpact](https://sketchfab.com/Drillimpact) ([Sketchfab](https://sketchfab.com/3d-models/giant-cockroach-4b19ed8851f74c278eef835250a82896)), used under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) · materials adjusted to take the game's light and fog, and rescaled
- **"PS1 Pig"** model by [joann5632](https://sketchfab.com/ioann5632) ([Sketchfab](https://sketchfab.com/3d-models/ps1-pig-cb937687727d44319a04d10afdcb0863)), used under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) · colours dirtied up, and the walk/graze animation made in code
- **"Lowpoly Male Base Mesh"** model by [arsenios](https://sketchfab.com/arsenikos) ([Sketchfab](https://sketchfab.com/3d-models/lowpoly-male-base-mesh-306da5c94111424b8017617b885f1a13)), used under the Sketchfab Standard License · used as the body of "the Lost"; all animation made in code
- **"PS1/PSX style low poly plate armor"** model by [annaumurn](https://sketchfab.com/annaumurn) ([Sketchfab](https://sketchfab.com/3d-models/ps1psx-style-low-poly-plate-armor-8eb583c1a9594f999f476d1871d07d8b)), used under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) · iron dulled, a two-handed sword added, and all animation made in code
- **"Psx hands monster (ps2 style)"** model by [petya-petyavich](https://sketchfab.com/petya-petyavich) ([Sketchfab](https://sketchfab.com/3d-models/psx-hands-monster-ps2-style-0a6e7d2ae4844b88967d8c5163d72815)), used under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) · scaled up 9 times as the King of a Hundred Hands boss; all animation made in code
- **"Low Poly Micolash"** model by [ratmeaty](https://sketchfab.com/ratmeaty) ([Sketchfab](https://sketchfab.com/3d-models/low-poly-micolash-35dd000256d74cf596d79067b5c304c8)), used under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) · used as the body of the Coffin-Bearer; arms lowered, bound to the game's skeleton, coffin and team-coloured cloth added
- **"BOUNTY HUNTER"** model by [EZ-GAZI](https://sketchfab.com/EZ-GAZI) ([Sketchfab](https://sketchfab.com/3d-models/bounty-hunter-1b78c05dd09245a9a2b2906e12b1dc08)), used under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) · used as the body of Oren the Hunter; skeleton and all animation made in code, skinning knife added
- **"Knight Set Dark Souls 1 - PS1 Style"** model by [MoiDev](https://sketchfab.com/moidev) ([Sketchfab](https://sketchfab.com/3d-models/knight-set-dark-souls-1-ps1-style-cded980e88324f758f5ca32033a71548)), used under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) · used as the body of the Wanderer; arms lowered from T-pose, bound to the game's skeleton, longsword, lantern and team-coloured cloth added
- [three.js](https://threejs.org) and GLTFLoader / SkeletonUtils (MIT) · [PeerJS](https://peerjs.com) (MIT)
