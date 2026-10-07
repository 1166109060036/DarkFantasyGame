# Prompt ตัวละครผู้เล่น (ฮีโร่ 5 วิถี)

ตัวละครที่ผู้เล่นบังคับเป็นโมเดลที่สำคัญที่สุดในเกม เพราะตอนเล่นออนไลน์ทุกคนจะเห็นตัวของคนอื่นตลอด เอกสารนี้จึงละเอียดกว่า [`MODEL_PROMPTS.md`](MODEL_PROMPTS.md) โดยออกแบบให้ **อ่านออกในการต่อสู้** ด้วย ไม่ใช่แค่สวย

ใช้คู่กับ `MODEL_PROMPTS.md` ได้เลย ทั้งสไตล์กลาง negative prompt checklist ใน Blender และชื่อกระดูก ใช้ชุดเดียวกัน

---

## 1. หลักออกแบบสำหรับการสู้กันออนไลน์

ทั้ง 5 ตัวยึด 5 ข้อนี้ prompt ทุกอันเขียนตามนี้แล้ว

1. **รู้ว่าเป็นวิถีไหนจากเงาดำอย่างเดียว** ในหมอกที่ระยะ 30 เมตร ผู้เล่นต้องบอกได้ทันทีว่าศัตรูเป็นวิถีอะไร (ถืออะไร ตีแบบไหน) ทุกตัวจึงมี **รูปทรงเด่นหนึ่งอย่าง** ที่ไม่ซ้ำกัน:

   | วิถี | รูปทรงเด่น (มองจากไกล) | แสงประจำตัว |
   |---|---|---|
   | ผู้พเนจร | ฮู้ดแหลมกับผ้าคลุมยาวปลิว ดาบยาวตรง | ตะเกียงจันทร์ **สีฟ้าซีด** ที่เอว |
   | ผู้ตีระฆัง | **ระฆังทองเหลืองใบใหญ่** บนด้ามยาวพาดไหล่ หมวกปีกกว้าง | ไม่เรืองแสง แต่ทองเหลืองสะท้อนแสงเด่น |
   | หมอปลิง | ผอมสูง หลังค่อม **หน้ากากจะงอยปาก** | ขวดปลิงที่สายคาดอก เรือง **แดงเข้ม** |
   | สัปเหร่อแบกโลง | ตัวใหญ่ที่สุด **โลงศพทรงหกเหลี่ยม** ยาวเกือบเท่าตัว | ช่องที่ฝาโลงเรือง **เขียวซีด** (วิญญาณศพในโลง) |
   | ผู้แบกไส้เทียน | **หัวเป็นเทียนแท่งสูง** มีเปลวไฟ กระถางไฟห้อยโซ่ | เปลวไฟ **ส้มทอง** ที่หัวและที่กระถาง |

2. **สีทีมต้องเห็นจากทุกทิศ** ผ้าส่วนใหญ่ (ผ้าคลุม เสื้อตัวนอก ผ้าคาดเอว ผ้าพันแขน) ต้องเป็น **สีเทาอ่อนล้วน** และแยกเป็นวัสดุชื่อ **`team`** แล้วเกมจะย้อมเป็นแดง ฟ้า เขียว หรือทองเอง ควรให้ส่วนนี้กินพื้นที่ **ประมาณ 30–40% ของตัว** เพื่อให้มองจากด้านหลังก็รู้ทีม
3. **สัดส่วนแบบเกม PS2** มือ อาวุธ และหัวใหญ่กว่าคนจริงเล็กน้อย (ประมาณ 10–15%) ท่าทางอ่านง่าย จะได้เห็นว่ากำลังจะฟันตอนไหน
4. **อาวุธแยกชิ้น** ทำเป็นวัตถุชื่อ **`weapon`** แยกจากตัว ผูกกับมือขวา (กระดูก `haR`) เกมจะใช้อาวุธชิ้นเดียวกันนี้ในมุมมองบุคคลที่หนึ่งด้วย
5. **ส่วนเรืองแสง** แยกเป็นวัสดุชื่อ **`glow`** ใช้สีสว่างล้วน เพื่อให้กลางคืนก็ยังเห็นว่าใครอยู่ตรงไหน

---

## 2. สเปกเทคนิคของฮีโร่

| หัวข้อ | ค่า |
|---|---|
| ไฟล์ | `.glb` 1 ไฟล์ต่อวิถี (มีตัว อาวุธ และ rig อยู่ในไฟล์เดียว) |
| แกน / สเกล | เมตร · Y ขึ้น · หันหน้า +Z · origin ที่พื้นระหว่างเท้า |
| ความสูง | 1.8 ม. (สัปเหร่อ 2.0 ม. · ผู้แบกไส้เทียน 2.0 ม. นับรวมเปลวไฟ) |
| งบ triangle | ตัว 1,200–1,800 · อาวุธ 150–400 |
| เท็กซ์เจอร์ | ตัว **256×256** (ฮีโร่ได้ละเอียดกว่าตัวอื่น) · อาวุธ 128×128 · สีพื้นอย่างเดียว |
| วัสดุ | `body` (ผิว หนัง โลหะ) · `team` (ผ้าสีเทาอ่อน ให้เกมย้อมสี) · `glow` (ส่วนเรืองแสง) · `weapon` |
| Rig | กระดูก 16 ชิ้นตามข้อ 6 ของ `MODEL_PROMPTS.md` ใช้ auto-rig ได้ ส่งชื่อกระดูกมาให้ผมแปลง |
| ท่า | A-pose (แขนกาง 45°) |

**ท่าทาง (ถ้ามีให้ทำมาด้วยยิ่งดี ถ้าไม่มีผมเขียนท่าด้วยโค้ดเองได้)** ตั้งชื่อคลิปตามนี้:

`idle` · `walk` · `run` · `attack_light` · `attack_heavy` · `block` · `skill` · `hit` · `die`

ถ้าใช้ Mixamo หรือ auto-rig ของ Meshy/Tripo หาท่าที่ใกล้เคียงได้เลย ท่าเฉพาะวิถีมีดังนี้:
- `block` ของสัปเหร่อคือ **ยกโลงตั้งขึ้นเป็นกำแพง**
- `block` ของผู้แบกไส้เทียนคือ **เอามือป้องเปลวไฟบนหัว**
- `skill` ของหมอปลิงคือ **ท่าขว้าง**

---

## 3. วิธีใช้ prompt ในหน้านี้

ทุกวิถีมี 5 prompt:

| prompt | ใช้ทำอะไร |
|---|---|
| **A. Turnaround** | ภาพหน้า ข้าง หลัง ในภาพเดียว ใช้คุมแบบให้ตรงกันทุกมุม (ส่งเข้า image-to-3D แบบหลายมุมได้ ถ้าเครื่องมือรองรับ) |
| **B. Action** | ภาพท่าต่อสู้ ใช้เช็กว่าท่าทางอ่านง่ายและเท่ ไม่ต้องเอาไปทำ 3D |
| **C. 3D** | ใส่ช่องข้อความของเครื่องมือสร้าง 3D |
| **D. Weapon** | สร้างอาวุธแยก ใช้ทั้งในมือตัวละครและในมุมมองบุคคลที่หนึ่ง |
| **E. หญิง** | ประโยคสำหรับแทนส่วนที่บอกไว้ เพื่อทำแบบผู้หญิง (ทางเลือก) |

แนะนำให้ทำ **A ก่อน** เลือกภาพที่ชอบ แล้วใช้ภาพนั้นเป็นภาพอ้างอิงตอนทำ B และตอนแปลงเป็น 3D ตัวละครจะได้หน้าตาเหมือนกันทุกภาพ

ส่วนท้ายที่ซ้ำกันใน prompt ทุกอัน (สไตล์ PS2) **ตั้งใจให้ซ้ำ** เพื่อให้ copy ไปใช้ได้ทันทีโดยไม่ต้องต่อเอง

---

## 4. ผู้พเนจร — ดาบ

นักดาบผู้เดินทางมาจากแดนไกล เป็นตัวสมดุลที่สุด ป้องกันและปัดดาบได้ ตัวนี้คือหน้าตาของเกม ผู้เล่นใหม่ทุกคนเริ่มที่ตัวนี้

- **รูปทรงเด่น:** ฮู้ดปลายแหลม ผ้าคลุมยาวถึงน่องที่ขาดเป็นริ้ว ดาบยาวตรง ตะเกียงจันทร์เรืองฟ้าที่เอวซ้าย
- **สีทีม:** ผ้าคลุมกับฮู้ด และผ้าพันแขนข้างซ้าย
- **บุคลิก:** เงียบ เหนื่อยจากการเดินทาง แต่นิ่งและแม่น

**A. Turnaround**
```
Character turnaround sheet, front view, side view and back view of the same character side by side:
a weathered wandering swordsman, lean and tall, a long travel-worn hooded cloak with a pointed hood
and a ragged hem torn into strips at calf height (cloak and hood in plain light grey), the hood
casting the upper face in shadow, a stubbled tired face with a thin scar across the cheek, a dark
brown leather jerkin with simple buckles over a dark tunic, a wide belt with a pouch, a small square
iron moon-lantern hanging at the left hip glowing pale ice-blue, wrapped forearms with a light grey
cloth band on the left arm, dark trousers and tall worn boots, a worn straight longsword with a plain
crossguard held in the right hand. Calm, scarred, alone. PS2-era low-poly 3D game character, early
2000s PlayStation 2 dark fantasy, faceted low-polygon silhouette with simple chunky readable shapes,
slightly oversized hands and weapon, small hand-painted low-resolution texture, matte, no specular,
lantern as flat bright emissive. Neutral A-pose, plain dark grey background, consistent design in all views.
```

**B. Action**
```
The same weathered wandering swordsman in a light grey hooded cloak, mid-swing with his straight
longsword in a wide diagonal slash, cloak flaring behind him, the moon-lantern at his hip swinging
and glowing pale blue, low dynamic camera angle, foggy moonlit swamp road at night. PS2-era
low-poly 3D game screenshot, early 2000s PlayStation 2 dark fantasy, faceted low polygons,
low-resolution hand-painted textures, cold blue moonlight, soft bloom.
```

**C. 3D**
```
low-poly PS2-style wandering swordsman, pointed hood and long ragged cloak in plain light grey,
brown leather jerkin, small iron lantern with blue glow at left hip, tall worn boots, straight
longsword in right hand as separate object, slightly oversized hands, hand-painted 256px texture,
~1500 triangles, A-pose, rigged humanoid
```

**D. Weapon**
```
A single worn straight longsword, 1.1 metres long: a plain steel blade with a darker fuller down the
middle and nicks along the edges, a simple flat iron crossguard, a dark leather-wrapped grip, a round
brass pommel. PS2-era low-poly 3D game weapon, about 200 triangles, small hand-painted
low-resolution texture, matte steel, isolated on a plain dark grey background, side view.
```

**E. หญิง**: แทน `a stubbled tired face with a thin scar across the cheek` ด้วย
```
a sharp-featured tired woman's face with a thin scar across the cheek, a dark braid falling from the hood
```

---

## 5. ผู้ตีระฆัง — ค้อนระฆัง

ผู้ดูแลระฆังของวิหารที่จมน้ำ ฟันตรงจังหวะเพลงจะแรงขึ้น สกิลคือตีระฆังใหญ่ให้ศัตรูรอบตัวกระเด็น

- **รูปทรงเด่น:** **ระฆังทองเหลืองใบใหญ่** เป็นหัวค้อนด้ามยาว (เห็นชัดที่สุดในทั้ง 5 ตัว) หมวกปีกกว้างทรงพระธุดงค์ จีวรหรือเสื้อคลุมเปียกน้ำ
- **สีทีม:** เสื้อคลุมยาวตัวนอก และผ้าคาดเอว
- **บุคลิก:** สงบเหมือนนักบวช แต่ตีหนักและเป็นจังหวะ มีเชือกผูกกระดิ่งเล็ก ๆ ห้อยที่เอว

**A. Turnaround**
```
Character turnaround sheet, front view, side view and back view of the same character side by side:
the bell-keeper of a drowned temple, a sturdy monk-like figure, a wide flat-brimmed straw-and-reed
hat with a few dangling cords, a calm weathered face with closed meditative eyes and a short grey
beard, a long heavy layered robe in plain light grey with a dark waterlogged hem and water stains,
a light grey sash belt hung with a rope of small tarnished bronze bells, wrapped shins and straw
sandals, a coil of old bell rope across the chest, carrying a long-handled war hammer whose head is
a dented polished brass church bell the size of a bucket, resting on his right shoulder.
Hears the rhythm in everything. PS2-era low-poly 3D game character, early 2000s PlayStation 2 dark
fantasy, faceted low-polygon silhouette with simple chunky readable shapes, slightly oversized hands
and weapon, small hand-painted low-resolution texture, matte, the brass bell bright and warm.
Neutral A-pose, plain dark grey background, consistent design in all views.
```

**B. Action**
```
The same drowned-temple bell-keeper in a light grey robe and wide reed hat, bringing his huge brass
bell hammer down onto the ground in a ringing blow, a visible circular shockwave of sound rippling
outward, small bells on his belt jumping, water splashing, low dynamic camera angle, flooded temple
ruins at night. PS2-era low-poly 3D game screenshot, early 2000s PlayStation 2 dark fantasy, faceted
low polygons, low-resolution hand-painted textures, cold blue moonlight, warm brass highlights, soft bloom.
```

**C. 3D**
```
low-poly PS2-style monk-like bell keeper, wide flat reed hat, long heavy robe and sash in plain
light grey with dark wet hem, rope of small bronze bells at the waist, straw sandals, long-handled
hammer with a big brass bell as its head as separate object, hand-painted 256px texture,
~1500 triangles, A-pose, rigged humanoid
```

**D. Weapon**
```
A single long-handled bell war hammer, 1.2 metres long: a dark wooden shaft wrapped in old rope near
the grip, and as its head a dented polished brass church bell (about 30 cm) mounted sideways on an
iron collar, with a small bronze bell hanging under the head. PS2-era low-poly 3D game weapon, about
300 triangles, small hand-painted low-resolution texture, warm brass and dark wood, isolated on a
plain dark grey background, side view.
```

**E. หญิง**: แทน `a calm weathered face with closed meditative eyes and a short grey beard` ด้วย
```
a calm weathered woman's face with closed meditative eyes and a shaved head under the hat
```

---

## 6. หมอปลิง — มีดกรีด + ปลิง

หมอเถื่อนจากบึง รักษาทุกโรคด้วยการเอาเลือดออก เลือดไม่ฟื้นเอง ยิ่งเลือดน้อยยิ่งตีแรง ขว้างปลิงไปดูดเลือดศัตรูแล้วปลิงคลานกลับมาเติมเลือดให้

- **รูปทรงเด่น:** ผอมสูง ไหล่ห่อ **หน้ากากผ้าทรงจะงอยปาก** (คล้ายหมอโรคระบาดแต่เป็นผ้าเย็บมือ) เสื้อกาวน์หนังยาว ขวดแก้วเรืองแดงเรียงที่สายคาดอก
- **สีทีม:** เสื้อเชิ้ตตัวใน แขนเสื้อที่พับขึ้น และผ้าคลุมไหล่สั้น
- **บุคลิก:** น่าขนลุก เย็นชาแบบหมอ เคลื่อนไหวว่องไว มีปลิงเกาะแขนเปลือย

**A. Turnaround**
```
Character turnaround sheet, front view, side view and back view of the same character side by side:
a back-alley swamp leech doctor, thin, tall and slightly hunched, a stitched cloth plague-doctor
mask with a short curved beak and round dark glass eyepieces, a long stained brown leather surgeon's
coat open at the front, a short shoulder cape and a shirt with rolled-up sleeves in plain light grey,
bare pale forearms with two fat black leeches clinging to them, a leather bandolier across the
chest holding six small glass jars glowing dark red with live leeches inside, a belt of rusty
surgical tools, thin dark trousers and buckled boots, a short curved lancet knife in the right hand.
Creepy and clinical. PS2-era low-poly 3D game character, early 2000s PlayStation 2 dark fantasy,
faceted low-polygon silhouette with simple chunky readable shapes, slightly oversized hands and
weapon, small hand-painted low-resolution texture, matte, jars as flat dark-red emissive.
Neutral A-pose, plain dark grey background, consistent design in all views.
```

**B. Action**
```
The same beaked leech doctor in a long leather coat and light grey shirt, lunging forward and
flicking a fat black leech through the air at an enemy with his left hand while the curved lancet
in his right hand drips blood, red-glowing jars on his chest, low dynamic camera angle, misty swamp
at night. PS2-era low-poly 3D game screenshot, early 2000s PlayStation 2 dark fantasy, faceted low
polygons, low-resolution hand-painted textures, cold blue moonlight, dark red glow, soft bloom.
```

**C. 3D**
```
low-poly PS2-style thin hunched leech doctor, stitched cloth beak mask with round dark eyepieces,
long brown leather coat, light grey shirt and short cape, bandolier of small red-glowing jars,
black leeches on bare forearms, curved lancet in right hand as separate object, hand-painted 256px
texture, ~1500 triangles, A-pose, rigged humanoid
```

**D. Weapon**
```
A single short curved surgeon's lancet knife, 35 centimetres long: a thin curved steel blade stained
with old dried blood, a bone-white handle with a round knob at the end, and a small black leech
coiled around the wrist end of the handle. PS2-era low-poly 3D game weapon, about 150 triangles,
small hand-painted low-resolution texture, matte, isolated on a plain dark grey background, side view.
```
ตัวปลิงที่ขว้าง (แยกชิ้น ~60 triangles):
```
A single fat black-purple swamp leech, 25 centimetres long, glossy segmented body tapering at both
ends with a small round sucker mouth. PS2-era low-poly 3D game prop, about 60 triangles,
low-resolution hand-painted texture, isolated on a plain dark grey background.
```

**E. หญิง**: แทน `thin, tall and slightly hunched` ด้วย
```
a thin, tall, slightly hunched woman with a tight bun of black hair behind the mask
```

---

## 7. สัปเหร่อแบกโลง — โลงศพ

สัปเหร่อที่ไม่มีใครจ้าง เดินเก็บศพที่ไม่มีใครฝัง ใช้โลงศพเป็นอาวุธ ยกโลงขึ้นเป็นกำแพงกันได้ทุกอย่างจากด้านหน้า เก็บศพเข้าโลงแล้วได้พลังของศพนั้น

- **รูปทรงเด่น:** **ตัวใหญ่ที่สุด** ไหล่กว้างมาก แบก **โลงศพทรงหกเหลี่ยมโบราณ** รัดแถบเหล็ก ยาวเกือบเท่าตัว หมวกทรงสูงของสัปเหร่อ
- **สีทีม:** เสื้อคลุมยาวแขนขาด และผ้าพันรอบโลง
- **แสงประจำตัว:** ช่องเล็ก ๆ ที่ฝาโลงมีแสงเขียวซีดรั่วออกมา คือวิญญาณของศพที่เก็บไว้
- **บุคลิก:** ช้า หนัก หยุดไม่อยู่ มีพลั่วเล็กเหน็บหลัง

**A. Turnaround**
```
Character turnaround sheet, front view, side view and back view of the same character side by side:
a huge broad-shouldered gravedigger, the largest and bulkiest of all heroes, a tall battered
undertaker's top hat, a grim heavy-jawed stubbled face, a long coat with the sleeves torn off in
plain light grey, huge bare muscular arms smeared with grave dirt, thick leather gloves, a heavy
belt with a small spade tucked behind, mud-caked trousers and big boots, gripping by an iron handle
a massive old hexagonal wooden coffin almost as tall as himself, banded with dark iron straps and a
light grey cloth wrapped around its middle, a thin crack in the lid leaking a pale ghostly green
light. Slow, heavy, unstoppable. PS2-era low-poly 3D game character, early 2000s PlayStation 2 dark
fantasy, faceted low-polygon silhouette with simple chunky readable shapes, oversized hands and
weapon, small hand-painted low-resolution texture, matte, the green light as flat emissive.
Neutral A-pose with the coffin standing upright beside him, plain dark grey background,
consistent design in all views.
```

**B. Action**
```
The same huge gravedigger in a sleeveless light grey coat and top hat, swinging his iron-banded
hexagonal coffin in a wide horizontal arc like a club, enemies being knocked away, pale green light
leaking from the cracked lid, low dynamic camera angle, graveyard in thick fog at night. PS2-era
low-poly 3D game screenshot, early 2000s PlayStation 2 dark fantasy, faceted low polygons,
low-resolution hand-painted textures, cold blue moonlight, ghostly green glow, soft bloom.
```

**C. 3D**
```
low-poly PS2-style huge broad-shouldered gravedigger, battered top hat, sleeveless long coat in
plain light grey, bare muscular dirty arms, leather gloves, mud boots, small spade on the back,
massive iron-banded hexagonal wooden coffin with green glowing crack as separate object,
hand-painted 256px texture, ~1700 triangles, A-pose, rigged humanoid, 2.0 m tall
```

**D. Weapon**
```
A single massive old hexagonal wooden coffin, 1.9 metres long: dark weathered planks, three dark
iron bands with rivets, an iron grip handle on one long side, a small iron cross on the lid, a light
grey cloth strip wrapped around the middle, a thin crack in the lid with pale ghostly green light
leaking out. PS2-era low-poly 3D game weapon, about 350 triangles, small hand-painted
low-resolution wood texture, matte, the green light as flat emissive, isolated on a plain dark grey
background, three-quarter view.
```

**E. หญิง**: แทน `a grim heavy-jawed stubbled face` ด้วย
```
a grim, broad, heavy-set woman's face with cropped grey hair under the hat
```

---

## 8. ผู้แบกไส้เทียน — กระถางไฟติดโซ่

ญาติห่าง ๆ ของเทียนหลอม เจ้าของโรงเตี๊ยม หัวเป็นเทียนที่ไม่เคยดับ แต่ละลายลงทุกลมหายใจ (เลือดคือไขเทียน) เหวี่ยงกระถางไฟให้ศัตรูติดไฟ ปักเทียนกันร่างซีดได้ เอามือป้องเปลวไฟเพื่อหายเข้าไปในความมืด

- **รูปทรงเด่น:** **หัวเป็นเทียนแท่งสูงแท่งเดียว** มีเปลวไฟส้มทองที่ยอด ไขเทียนไหลย้อยลงมาที่ปกเสื้อ ตัวผอมสูง กระถางไฟห้อยโซ่
- **สีทีม:** ซับในของเสื้อโค้ต ผ้าคาดเอว และผ้าพันข้อมือ
- **แสงประจำตัว:** เปลวไฟบนหัวกับถ่านในกระถาง (สีส้มทอง) เป็นตัวที่เห็นง่ายที่สุดตอนกลางคืน ซึ่งสมกับเกม เพราะสกิลของมันคือการดับแสงตัวเองเพื่อซ่อน
- **บุคลิก:** สุภาพ ลึกลับ เหมือนญาติที่ไม่มีใครอยากพูดถึง มีเทียนสำรองเหน็บที่เข็มขัด

**A. Turnaround**
```
Character turnaround sheet, front view, side view and back view of the same character side by side:
a slender, unnaturally tall gentleman whose head is a single tall melting cream-white candle with a
bright orange-gold flame at its tip, thick wax drips running down from the candle over the high
collar, a long fitted dark charcoal frock coat with its lining, a waist sash and wrist wraps in
plain light grey, a row of spare white candles tucked into a leather belt, thin dark gloves, long
dark trousers and pointed boots, holding in the right hand a long iron chain from which hangs a
pierced brass censer with glowing embers and wisps of smoke inside. Polite, eerie, melting away
with every breath. PS2-era low-poly 3D game character, early 2000s PlayStation 2 dark fantasy,
faceted low-polygon silhouette with simple chunky readable shapes, slightly oversized hands and
weapon, small hand-painted low-resolution texture, matte, the flame and embers as flat bright
emissive. Neutral A-pose, plain dark grey background, consistent design in all views.
```

**B. Action**
```
The same candle-headed gentleman in a dark frock coat with light grey lining, whirling a burning
brass censer on a long chain in a wide circle around himself, a ring of sparks and fire trailing
behind it, the flame on his candle head flaring, low dynamic camera angle, dark forest road with
lanterns at night. PS2-era low-poly 3D game screenshot, early 2000s PlayStation 2 dark fantasy,
faceted low polygons, low-resolution hand-painted textures, cold blue moonlight, warm orange fire
light, soft bloom.
```

**C. 3D**
```
low-poly PS2-style slender gentleman whose head is a single tall melting candle with a flame, wax
drips on the collar, dark charcoal frock coat with plain light grey lining, sash and wrist wraps,
spare candles on belt, brass censer on a long chain as separate object, flame as separate glow
mesh, hand-painted 256px texture, ~1500 triangles, A-pose, rigged humanoid, 2.0 m tall with flame
```

**D. Weapon**
```
A single pierced brass censer hanging from a 70-centimetre iron chain with a small wooden grip at
the top: a round lantern-like brass cage with six vertical bars and a domed lid, glowing orange
embers and a small flame inside. PS2-era low-poly 3D game weapon, about 250 triangles, small
hand-painted low-resolution texture, warm brass and dark iron, embers as flat bright emissive,
isolated on a plain dark grey background, side view.
```

**E. หญิง**: แทน 2 จุด
- `a slender, unnaturally tall gentleman` → `a slender, unnaturally tall lady`
- `a long fitted dark charcoal frock coat` → `a long fitted dark charcoal high-collared gown-coat`

---

## 9. ภาพรวม 5 ตัว (เช็กว่าแยกกันออกไหม)

สร้างภาพนี้ **หลังได้แบบของทุกตัวแล้ว** ถ้าในภาพนี้ดูเงาดำแล้วยังบอกไม่ได้ว่าใครเป็นใคร ให้กลับไปขยายรูปทรงเด่นของตัวนั้น

```
Character lineup of five dark fantasy heroes standing side by side at the same scale, all wearing
plain light grey team cloth: (1) a hooded wandering swordsman with a long ragged cloak, a straight
longsword and a small blue-glowing lantern at the hip; (2) a monk-like bell keeper in a wide flat
reed hat carrying a hammer whose head is a big brass bell; (3) a thin hunched leech doctor in a
stitched beak mask and long leather coat with red-glowing jars on a chest bandolier; (4) a huge
gravedigger in a top hat holding a massive iron-banded hexagonal coffin with green light leaking
from its lid; (5) a slender gentleman whose head is a tall melting candle with a flame, holding a
censer on a chain. PS2-era low-poly 3D game character lineup, early 2000s PlayStation 2 dark
fantasy, faceted low-polygon silhouettes, hand-painted low-resolution textures, matte, plain dark
grey background, front view, full bodies.
```

**เช็กเงาดำ:** เอาภาพ lineup เข้าโปรแกรมแต่งภาพ ปรับ Brightness ลงจนเหลือแต่เงาดำ ทั้ง 5 ตัวต้องยังแยกกันออก

---

## 10. หลังได้โมเดลแล้ว

1. ทำตาม checklist ข้อ 5 ใน `MODEL_PROMPTS.md`: ลด polygon ลดเท็กซ์เจอร์ ตัด PBR
2. ตรวจว่ามีวัสดุ 4 ชื่อครบ: `body` `team` `glow` `weapon` และผ้าสีทีมต้องเป็น **สีเทาอ่อนล้วน** ไม่มีสีอื่นปน
3. ตรวจว่าอาวุธเป็น **วัตถุแยก** ผูกกับกระดูก `haR`
4. Export `.glb` แล้วตั้งชื่อไฟล์ตามวิถี: `hero_wanderer.glb` `hero_bell.glb` `hero_leech.glb` `hero_coffin.glb` `hero_wick.glb`
5. ส่งมาให้ผม ผมจะใส่เข้าเกมดังนี้
   - ใช้แทนตัวชาวบ้านทาสีที่ใช้อยู่ตอนนี้ในโหมดออนไลน์
   - ต่อระบบย้อมสีทีม
   - ใส่ท่าทาง (ถ้าไม่มีคลิปท่ามา ผมเขียนให้ด้วยโค้ด)
   - เอาอาวุธไปใช้ในมุมมองบุคคลที่หนึ่งด้วย
