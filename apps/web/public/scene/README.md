# House scene sprites (placeholder kit)

Placeholder art for `<HouseScene>` (T12), drawn in the Dollhouse palette from `tokens.json` (ink outlines,
orange roof, warm paper walls, the chart colors as accents). The final kit from Kiko (D1, #27) replaces
these files **one-for-one by id**: keep each file name and path, and the scene picks up the new art with
no code change. Started from the placeholder sprites in #55 (Aibek), renamed to the engine's ids and recolored.

## Ids

A sprite id is the path without `.svg`: `garage/luxury` → `public/scene/garage/luxury.svg`. The ids are
defined in `packages/engine/scene.ts` (`SPRITE_IDS`); `sceneOf` is the only code that picks them, from the
same card fields that price the cost lines. A unit test fails if a file is missing for any id, and
every id has alt text in `apps/web/src/copy/game.ts` (`game.scene.sprites`).

| Id | Shown when | Card field → cost line |
| --- | --- | --- |
| `layout/studio`, `layout/1bed` … `layout/4bed` | always (the house shell, see below) | `bedrooms` → rentUtilities |
| `garage/none` | no car (a bike and a bus pass) | `car` → car |
| `garage/economy` / `garage/mid` / `garage/luxury` | car price < $25k / $25k–$45k / > $45k | `car.price` → car |
| `garage/loanTag` | the car is financed (price > down payment) | `car` → car loan payment |
| `kidsRoom/crib` / `toddler` / `preschool` / `schoolAge` | one per child, by age | `kids` → childcare, groceries |
| `kidsRoom/homeOffice` | no kids | `kids` → (no childcare) |
| `kitchen/takeout-0-1` / `2-3` / `4-6` / `7plus` | meals eaten out per week | `eatingOutPerWeek` → eatingOut |
| `entry/coat-adult`, `entry/coat-kid` | one per adult, one per child | `adults`, `kids` → groceries |
| `mailbox/tier-cheap` / `mid` / `expensive` / `suburb` | the ZIP's neighborhood tier | `zip`, tier → rentUtilities |
| `decor/skyline`, `lamp`, `plant`, `bed`, `bookshelf`, `tree` | always; depends only on the layout | none (decor never suggests a cost) |

Clue sprites are square (`viewBox="0 0 100 100"`), drawn to sit on the floor (bottom of the box), with
transparent backgrounds. Several can share a room (two kids, five coats), so keep them readable at
about 30% of a room's width.

## Room geometry (layout shells)

The `layout/*` sprites are the whole house on a **400 × 320** stage (`viewBox="0 0 400 320"`, 5:4). The
component lays the tappable rooms and the decor over the shell on this grid
(`apps/web/src/ui-kit/houseSceneGeometry.ts`), so a replacement shell must keep these rectangles
(x, y, width, height, in stage units):

| Room | Rectangle | |
| --- | --- | --- |
| `kidsRoom` | 84, 92, 80, 86 | upper floor, left |
| bedrooms | 164, 92, 140, 86 | upper floor, right: split evenly into one cell per bedroom (`bedroom1`…`bedroom4`); a studio has one `loft` cell and the bed in the living room |
| `entry` | 84, 178, 68, 106 | ground floor |
| `kitchen` | 152, 178, 76, 106 | ground floor |
| `living` | 228, 178, 76, 106 | ground floor, decor: the window (skyline) high on the wall, two floor spots |
| `garage` | 308, 190, 84, 94 | annex on the right |
| `mailbox` | 10, 196, 68, 88 | front yard, left |
| `yard` | 8, 104, 72, 88 | decor (the tree) |

Ground line at y = 284. Rooms stay covered (closed) until the player opens them, so a shell must not
draw anything inside a clue room that hints at its contents.
