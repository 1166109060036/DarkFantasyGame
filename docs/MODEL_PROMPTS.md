# Prompt สำหรับสร้างโมเดลตัวละคร Moonmire

เอกสารนี้ใช้สร้างโมเดล 3D ของตัวละครทุกตัวด้วยเครื่องมือ AI ให้ได้สไตล์เดียวกับในเกม คือเกม PS2 ยุคต้นปี 2000 แนว dark fantasy / folk horror

- **prompt เขียนเป็นภาษาอังกฤษ** เพราะเครื่องมือสร้างภาพและสร้าง 3D เกือบทุกตัวเข้าใจอังกฤษแม่นกว่ามาก
- **ภาพอ้างอิง** อยู่ใน [`docs/model-refs/`](model-refs/) เรนเดอร์จากในเกมตอนนี้ ภาพเหล่านี้กำหนด **รูปร่าง สัดส่วน และสี** ของแต่ละตัว ส่วน prompt กำหนด **ระดับรายละเอียด** โมเดลใหม่ควรละเอียดกว่าภาพอ้างอิง (ตอนนี้ต่อจากรูปทรงพื้นฐาน) แต่ยังต้องเป็น low-poly แบบ PS2

---

## 1. ขั้นตอนที่แนะนำ

1. **สร้างภาพคอนเซ็ปต์ก่อน** ด้วยตัวสร้างภาพ (Midjourney, ChatGPT/DALL·E, Leonardo, Stable Diffusion ฯลฯ)
   - ใช้ **Concept prompt** ของตัวนั้น
   - ถ้าเครื่องมือรับภาพอ้างอิงได้ ให้แนบภาพจาก `model-refs/` ของตัวนั้นไปด้วย (image prompt / style reference / img2img ความแรงประมาณ 0.3–0.5)
   - เลือกภาพที่ **เห็นเต็มตัว ยืนท่า A-pose หันหน้าตรง พื้นหลังเรียบ**
2. **แปลงภาพเป็น 3D** ด้วยเครื่องมือ image-to-3D (Meshy, Tripo, Rodin, Hunyuan3D ฯลฯ)
   - ถ้าเครื่องมือมีช่องข้อความให้ใส่ **3D prompt** ของตัวนั้น
   - ถ้ามีตัวเลือก ให้เปิด **low poly / จำกัดจำนวน polygon** ตามงบในตาราง และปิด PBR (ใช้แค่สีพื้น)
3. **เก็บงานใน Blender** ตาม checklist ข้อ 5 ขั้นนี้สำคัญที่สุดที่ทำให้ "ไม่หลุดสไตล์" เพราะเครื่องมือ AI มักให้โมเดลละเอียดและเนียนเกินไป
4. ส่งไฟล์ `.glb` มาให้ผม แล้วผมจะเขียนโค้ดโหลดเข้าเกม แทนตัวที่ต่อจากรูปทรงพื้นฐานอยู่ตอนนี้

---

## 2. สไตล์กลาง (ใส่ในทุก prompt)

**Style block** ใส่ไว้แล้วในทุก prompt ข้างล่าง ถ้าจะเขียน prompt ใหม่เองให้แปะต่อท้าย:

```
PS2-era low-poly 3D game character, early 2000s PlayStation 2 dark fantasy folk-horror,
faceted low-polygon silhouette with simple chunky readable shapes, small hand-painted
low-resolution diffuse texture with soft painted shading, matte, no specular, no normal-map detail,
moonlit swamp world palette: muted slate blues, moss greens, bone white, rust and damp wood browns,
with one or two vivid accents; glowing eyes as flat bright emissive colour
```

**Negative prompt** ใส่ในช่อง negative ถ้าเครื่องมือมี (Stable Diffusion, Leonardo, Meshy):

```
high poly, subdivided, smooth sculpt, photorealistic, PBR, glossy, reflective, fine micro detail,
4k texture, ornate filigree, anime, chibi, cartoon, Pixar style, cute, modern clothing, sci-fi,
text, watermark, logo, multiple characters, cropped, cut off feet, busy background
```

**ท่าทางสำหรับภาพคอนเซ็ปต์** ต่อท้ายได้ทุกตัว ยกเว้นตัวที่บอกท่าเฉพาะไว้:

```
full body, neutral A-pose, front three-quarter view, plain dark grey background, character turnaround style
```

---

## 3. สเปกเทคนิค (ให้ตรงกับเกม)

| หัวข้อ | ค่า |
|---|---|
| ไฟล์ | `.glb` (glTF binary) |
| หน่วย / แกน | เมตร · Y ชี้ขึ้น · **ตัวละครหันหน้าไปทาง +Z** · จุด origin อยู่ที่พื้นระหว่างเท้า |
| เท็กซ์เจอร์ | สีพื้นอย่างเดียว (base colour) **128×128** (บอสและตัวใหญ่ 256×256) ไม่มี normal / roughness / metal map |
| วัสดุ | 1 วัสดุหลัก + 1 วัสดุชื่อ `glow` สำหรับส่วนที่เรืองแสง (ตา เปลวไฟ ตะเกียง) เกมจะทำให้ส่วนนี้สว่างเองโดยไม่โดนแสงเงา |
| ท่า | A-pose สำหรับตัวที่ต้องขยับแขนขา · ตัวที่นั่งหรือมีท่าเฉพาะให้ทำตามที่ระบุ |
| เงา | ไม่ต้องอบเงาลงเท็กซ์เจอร์หนัก ๆ แค่ AO นุ่ม ๆ ได้ (เกมมีแสงจันทร์และหมอกของมันเอง) |

| ตัวละคร | ไฟล์ภาพอ้างอิง | ความสูงในเกม | งบ triangle | ส่วนที่ต้องขยับ |
|---|---|---|---|---|
| โกวัก ผู้เลี้ยงแกะหัวอีกา | `crow.jpg` | 2.3 ม. | 800–1,200 | หัวหันตามผู้เล่น |
| ยายคางคก | `toad.jpg` | 2.1 ม. (นั่ง) | 1,000–1,500 | ไม่มี (ตัวพองหายใจ) |
| เทียนหลอม เจ้าของโรงเตี๊ยม | `keeper.jpg` | 2.3 ม. | 800–1,200 | ไม่มี |
| ลุงทั่ง ช่างตีเหล็ก | `smith.jpg` | 2.4 ม. | 1,000–1,500 | ไม่มี |
| แขกโรงเตี๊ยม | `patron.jpg` | 1.5 ม. (นั่ง) | 400–700 | ไม่มี |
| แกะดำ | `sheep.jpg` | 1.2 ม. | 300–500 | ขาเดิน (ทั้งตัวขยับก็พอ) |
| หุ่นฟางคลั่ง | `straw.jpg` | 2.4 ม. รวมเสาไม้ | 600–900 | แขน (คานขวาง) |
| หมาป่าเงา | `wolf.jpg` | ยาว 2.3 ม. | 700–1,000 | หัว + ขา 4 ข้าง |
| ปลิงยักษ์ | `leech.jpg` | ยาว 3.6 ม. | 600–900 | 6 ปล้อง แยกชิ้น |
| อัศวินหินผู้เฝ้าสะพาน (บอส) | `knight.jpg` | 4.5 ม. | 2,000–3,000 | แขนขวาถือดาบ |
| ร่างซูบ | `gaunt.jpg` | 1.9 ม. | 900–1,300 | rig มนุษย์ (ข้อ 6) |
| ร่างคลาน | `crawler.jpg` | 1.9 ม. (เดินสี่ขา) | 900–1,300 | rig มนุษย์ |
| หญิงร่ำไห้ | `weeper.jpg` | 2.3 ม. | 1,000–1,500 | rig มนุษย์ |
| ร่างซูบยักษ์ | `brute.jpg` | 3.3 ม. | 1,200–1,800 | rig มนุษย์ |
| ราชาประจำฐาน (ออนไลน์) | — | 1.6 ม. (นั่งบนบัลลังก์) | 800–1,200 | ไม่มี |
| ฮีโร่ 5 วิถี (ออนไลน์) | — | 1.8–2.0 ม. | 1,200–1,800 | ดู `HERO_PROMPTS.md` |

---

## 4. Prompt รายตัว

แต่ละตัวมี 2 prompt:
- **Concept**: สำหรับสร้างภาพ
- **3D**: ฉบับสั้นสำหรับช่องข้อความของเครื่องมือ text-to-3D หรือ image-to-3D

### 4.1 ชาวบึง (NPC เนื้อเรื่อง)

#### โกวัก ผู้เลี้ยงแกะหัวอีกา — `crow.jpg`
ผู้เลี้ยงแกะลึกลับ หัวเป็นอีกา ใส่ฮู้ดเขียวมอส ตาเรืองฟ้า ยืนเฝ้าคอกแกะ

**Concept**
```
A tall hooded shepherd with the head of a crow: long dark slate-blue beak, small round head with two
glowing ice-blue eyes, wearing a heavy moss-green wool hood and a thick rolled moss-green scarf,
a long floor-length robe of dark navy-blue feathers that flares at the hem, a rope belt in faded
ochre, thin feathered arms held forward with pale grey-blue bird-like hands, quiet and watchful,
gentle but uncanny. PS2-era low-poly 3D game character, early 2000s PlayStation 2 dark fantasy
folk-horror, faceted low-polygon silhouette with simple chunky readable shapes, small hand-painted
low-resolution diffuse texture, matte, muted slate blues and moss greens, glowing eyes as flat
bright emissive. Full body, standing, front three-quarter view, plain dark grey background.
```
**3D**
```
low-poly PS2-style crow-headed shepherd, dark navy feathered floor-length robe, moss-green hood and
scarf, long dark beak, glowing blue eyes, rope belt, hand-painted 128px texture, ~1000 triangles
```

#### ยายคางคก — `toad.jpg`
หญิงชราร่างคางคกนั่งใต้เห็ดยักษ์ กอดหม้อดินกับช้อนไม้ มีทองกองเล็ก ๆ ใส่หมวกปีกกว้าง

**Concept**
```
An old toad crone sitting on the ground: huge round pale-cream warty toad body and wide flat head,
big bulging eyes with tiny black pupils, a wide thin mouth, wrapped in a ragged earthy brown shawl
that falls open at the front, a fat rolled brown scarf around her neck, a battered wide-brimmed
flat brown hat, holding a small terracotta clay pot and a long wooden spoon, a little heap of gold
coins in her lap, webbed feet poking out. Wise, grumpy, a swamp witch who brews potions.
PS2-era low-poly 3D game character, early 2000s PlayStation 2 dark fantasy folk-horror, faceted
low-polygon silhouette, simple chunky shapes, small hand-painted low-resolution texture, matte.
Full body, seated pose, front three-quarter view, plain dark grey background.
```
**3D**
```
low-poly PS2-style seated toad witch, pale cream warty skin, brown ragged shawl, wide flat brimmed
hat, clay pot and wooden spoon, gold coins in lap, hand-painted 128px texture, ~1200 triangles
```

#### เทียนหลอม เจ้าของโรงเตี๊ยม — `keeper.jpg`
สุภาพบุรุษชุดดำ หัวเป็นกลุ่มเทียนที่ละลายลงมา (ชื่อโรงเตี๊ยม "เทียนหลอม")

**Concept**
```
A tall thin innkeeper gentleman in a long black frock coat with a white shirt front and a narrow
white cravat, pale gloved hands folded in front, and instead of a head, a cluster of many melting
cream-white candles of different heights on a round dome of pooled wax, each with a small warm
orange flame, wax drips running down onto his collar. Polite, eerie, welcoming. PS2-era low-poly
3D game character, early 2000s PlayStation 2 dark fantasy folk-horror, faceted low-polygon
silhouette, simple chunky shapes, small hand-painted low-resolution texture, matte, the candle
flames as flat bright emissive. Full body, standing, front three-quarter view, plain dark grey
background.
```
**3D**
```
low-poly PS2-style innkeeper in a black frock coat whose head is a cluster of melting candles with
flames, white shirt front, gloved hands, hand-painted 128px texture, flames as separate glow mesh,
~1000 triangles
```

#### ลุงทั่ง ช่างตีเหล็ก — `smith.jpg`
ช่างตีเหล็กตัวใหญ่ หัวล้าน เคราเทา ผ้ากันเปื้อนหนัง แบกค้อนพาดไหล่

**Concept**
```
A broad, burly old village blacksmith: bald tanned head, short thick grey beard, bushy grey
eyebrows, small dark eyes, big strong bare forearms, a rough grey-brown linen shirt with sleeves
rolled up, a long dark brown leather apron with shoulder straps, dark trousers, heavy boots,
an iron sledgehammer resting on his right shoulder. Gruff but kind. PS2-era low-poly 3D game
character, early 2000s PlayStation 2 dark fantasy, faceted low-polygon silhouette, simple chunky
shapes, small hand-painted low-resolution texture, matte. Full body, standing, front three-quarter
view, plain dark grey background.
```
**3D**
```
low-poly PS2-style burly bald blacksmith with grey beard, leather apron over linen shirt, hammer on
shoulder, hand-painted 128px texture, ~1200 triangles
```

#### แขกโรงเตี๊ยม — `patron.jpg`
ชาวบ้านใส่ฮู้ดนั่งดื่ม (เกมเปลี่ยนสีเสื้อเองได้ ให้ทำเสื้อเป็นสีเทากลาง)

**Concept**
```
A tired peasant villager sitting on a bench holding a wooden mug with both hands, wearing a simple
hooded wool tunic in plain mid-grey, hood up, weathered face half in shadow, rough trousers and
wrapped shoes. PS2-era low-poly 3D game character, early 2000s PlayStation 2 dark fantasy, faceted
low-polygon silhouette, simple shapes, small hand-painted low-resolution texture, matte.
Full body, seated pose, front three-quarter view, plain dark grey background.
```
**3D**
```
low-poly PS2-style seated hooded peasant holding a wooden mug, plain mid-grey tunic (to be tinted
in game), hand-painted 128px texture, ~600 triangles
```

#### แกะดำ — `sheep.jpg`
แกะขนดำอมม่วงเทา หน้าและขาสีเข้ม

**Concept**
```
A black sheep: a round fluffy body of dark charcoal wool with a faint violet-grey tint, clumpy
wool tufts, a small dark sooty face with droopy ears and dull eyes, thin dark legs. Slightly eerie
in the moonlight. PS2-era low-poly 3D game animal, faceted low-polygon silhouette, simple chunky
shapes, small hand-painted low-resolution texture, matte. Full body, side three-quarter view,
plain dark grey background.
```
**3D**
```
low-poly PS2-style black sheep, dark charcoal-violet wool body, sooty face, thin dark legs,
hand-painted 128px texture, ~400 triangles
```

### 4.2 ศัตรู

#### หุ่นฟางคลั่ง — `straw.jpg`
หุ่นไล่กาเสียบเสาไม้ หัวเป็นกระสอบ หมวกปีกกว้าง ตาไฟแดงส้ม ตื่นตอนกลางวันแล้วกระโดดไล่

**Concept**
```
A possessed scarecrow impaled on a wooden pole: a burlap sack head with a crude stitched mouth and
two glowing ember-orange eyes, a crooked wide-brimmed pointed witch-like straw hat, a ragged dark
brown patched coat, arms stretched out along a crossbar with bundles of straw bursting from the
sleeves, a skirt of straw spikes at the hem, the pole visible below instead of legs. Menacing and
wrong. PS2-era low-poly 3D game monster, early 2000s PlayStation 2 folk-horror, faceted
low-polygon silhouette, simple chunky shapes, small hand-painted low-resolution texture, matte,
eyes as flat bright emissive. Full body, front three-quarter view, plain dark grey background.
```
**3D**
```
low-poly PS2-style evil scarecrow on a pole, burlap sack head with glowing orange eyes, wide
pointed hat, ragged brown coat, arms on a crossbar with straw tufts, hand-painted 128px texture,
~800 triangles
```

#### หมาป่าเงา — `wolf.jpg`
หมาป่าขนเทาเข้มอมน้ำเงิน ผอม ตาเรืองฟ้า

**Concept**
```
A lean shadow wolf: dark slate-grey fur with a cold blue tint, scruffy fur tufts along the spine,
narrow long muzzle, pointed ears, thin long legs, a low thin tail, two glowing ice-blue eyes,
hunched and hungry. PS2-era low-poly 3D game monster, early 2000s PlayStation 2 dark fantasy,
faceted low-polygon silhouette, simple chunky shapes, small hand-painted low-resolution fur
texture, matte, eyes as flat bright emissive. Full body, side three-quarter view, plain dark grey
background.
```
**3D**
```
low-poly PS2-style lean shadow wolf, dark blue-grey fur, glowing blue eyes, thin legs, hand-painted
128px texture, ~900 triangles, head and four legs as separate parts
```

#### ปลิงยักษ์ — `leech.jpg`
ปลิงยักษ์โผล่จากน้ำ ตัวเป็นปล้อง ๆ สีม่วงอมชมพู ปากกลมมีฟันวงรอบ

**Concept**
```
A giant swamp leech rearing up out of black water: a long body of six bulging segments, slimy
mauve-purple skin fading darker toward the tail, glistening, a round sucker mouth ringed with pink
flesh and a circle of small bone-white hooked teeth around a black throat. Disgusting and
threatening. PS2-era low-poly 3D game monster, early 2000s PlayStation 2 dark fantasy, faceted
low-polygon silhouette, simple chunky shapes, small hand-painted low-resolution texture, matte.
Full body, side three-quarter view, plain dark grey background.
```
**3D**
```
low-poly PS2-style giant leech, six mauve-purple segments, round sucker mouth with a ring of white
teeth, hand-painted 128px texture, ~800 triangles, each segment a separate part
```

#### อัศวินหินผู้เฝ้าสะพาน (บอส) — `knight.jpg`
อัศวินหินมอสสีฟ้าเทา สวมมงกุฎ ช่องตาเรืองส้ม ถือดาบหินยักษ์

**Concept**
```
A colossal guardian knight carved from pale blue-grey stone, blocky and massive: a square helm
with a single narrow glowing amber-orange eye slit and a small crown of mossy stone points on top,
broad boxy chest, round shoulder pauldrons overgrown with thick green moss, a belt of moss,
thick pillar legs, cracks and lichen across the stone, holding a huge plain stone greatsword with
a wooden-wrapped grip pointing to the ground. Ancient, silent, immovable. PS2-era low-poly 3D game
boss, early 2000s PlayStation 2 dark fantasy, faceted blocky low-polygon silhouette, simple chunky
shapes, hand-painted low-resolution stone texture with moss, matte, eye slit as flat bright
emissive. Full body, front three-quarter view, plain dark grey background.
```
**3D**
```
low-poly PS2-style giant stone knight boss, blocky blue-grey stone body, moss-covered shoulders,
crowned square helm with glowing orange eye slit, huge stone greatsword, hand-painted 256px
texture, ~2500 triangles, right arm and sword as a separate part
```

#### ร่างซูบ — `gaunt.jpg`
หนึ่งใน "เหล่าร่างซีด": คนผอมโซ ผิวซีด มีคราบเลือดไหลเป็นทาง ผมเทายาวลีบ แขนยาวถึงเข่า หลังค่อม วิ่งพุ่งเมื่อเข้าใกล้

**Concept**
```
An emaciated pale humanoid horror: hunched, bony, skin the colour of old bone and wax with
grey-violet bruising and long streaks of dried dark-red blood running down from wounds, a narrow
skull with sunken black eye sockets, hollow cheeks and a slack open mouth, long stringy greasy grey
hair hanging over the face, arms so long the clawed fingers reach the knees, a jutting pelvis and
visible ribs. Survival-horror creature. PS2-era low-poly 3D game monster, early 2000s PlayStation 2
horror, faceted low-polygon silhouette, simple shapes, small hand-painted low-resolution skin
texture with painted blood streaks, matte. Full body, neutral A-pose, front three-quarter view,
plain dark grey background.
```
**3D**
```
low-poly PS2-style emaciated pale ghoul, bone-white skin with dried blood streaks, long stringy grey
hair over face, very long arms, hunched, hand-painted 128px texture, ~1100 triangles, A-pose,
rigged humanoid
```

#### ร่างคลาน — `crawler.jpg`
ร่างซีดที่คลานสี่ขาเหมือนแมงมุม (ปั้นในท่ายืน A-pose เกมจะทำท่าคลานเอง)

**Concept**
```
A pale skittering humanoid horror that crawls on all fours like a spider: thin and wiry, grey-white
waxy skin with dried blood smears, short stringy grey hair, elbows and knees bent sharply upward,
fingers splayed on the ground, head twisted up at an unnatural angle with a gaping mouth.
PS2-era low-poly 3D game monster, early 2000s PlayStation 2 horror, faceted low-polygon silhouette,
simple shapes, small hand-painted low-resolution skin texture, matte. Full body, crawling pose,
side three-quarter view, plain dark grey background.
```
**3D** (ปั้นในท่า A-pose ยืนตรง สัดส่วนเหมือนในภาพ แล้วเกมจะสั่งท่าคลานเอง)
```
low-poly PS2-style thin wiry pale ghoul, grey-white skin with blood smears, short stringy grey hair,
hand-painted 128px texture, ~1100 triangles, standing A-pose, rigged humanoid
```

#### หญิงร่ำไห้ — `weeper.jpg`
ผู้หญิงสูงผิดปกติในชุดยาวขาวขาดเปื่อย ผมยาวคลุมหน้าทั้งหมด จะขยับเมื่อผู้เล่นหันหลัง

**Concept**
```
An unnaturally tall gaunt woman in a long rotted off-white burial gown stained with old blood,
torn at the hem and sleeves, very long straight grey-white hair falling over and completely
hiding her face down to her waist, thin pale arms hanging limp with long fingers, bare grey feet.
Still, silent, terrifying. PS2-era low-poly 3D game monster, early 2000s PlayStation 2 horror,
faceted low-polygon silhouette, simple shapes, small hand-painted low-resolution cloth and hair
texture, matte. Full body, standing straight, front three-quarter view, plain dark grey background.
```
**3D**
```
low-poly PS2-style tall ghost woman, long rotted off-white gown with blood stains, long grey hair
covering the face, thin pale arms, hand-painted 128px texture, ~1300 triangles, A-pose, rigged humanoid
```

#### ร่างซูบยักษ์ — `brute.jpg`
ร่างซีดยักษ์สูงสามเมตร หนาเทอะทะ ทุบพื้นทุกสองครั้ง

**Concept**
```
A hulking three-metre giant made of the same pale bloodied flesh as the gaunts: massively broad
shoulders and huge heavy arms with oversized fists, a small head sunk between the shoulders with
short stringy grey hair, a sagging belly, thick legs, waxy grey-pink skin covered in dried blood
streaks and dark wounds. Slow and devastating. PS2-era low-poly 3D game monster, early 2000s
PlayStation 2 horror, faceted low-polygon silhouette, simple chunky shapes, hand-painted
low-resolution skin texture, matte. Full body, neutral A-pose, front three-quarter view, plain
dark grey background.
```
**3D**
```
low-poly PS2-style hulking pale flesh giant, huge arms and fists, small head, grey-pink skin with
dried blood, hand-painted 256px texture, ~1500 triangles, A-pose, rigged humanoid
```

> **วิญญาณบึง (wisp)** ไม่ต้องทำโมเดล ในเกมเป็นแค่ลูกแสงเรือง ใช้ effect ดีกว่า

### 4.3 โหมดออนไลน์ (ศึกราชาจันทรา)

> **สีประจำฐาน:** ส่วนที่เป็นสีทีม (เสื้อคลุม ธง ผ้าคาด) ให้ทำเป็น **สีเทาอ่อนหรือขาวล้วน** แล้วเกมจะย้อมเป็นแดง ฟ้า เขียว หรือทองเอง

#### ราชาประจำฐาน
**Concept**
```
An old king seated on a heavy stone throne: a tall golden crown with five points, long white beard,
stern tired face, a long royal robe and cape in plain light grey (to be tinted with team colour),
a gold chain of office, hands resting on the arms of the throne, a sword laid across his knees.
Proud and doomed. PS2-era low-poly 3D game character, early 2000s PlayStation 2 dark fantasy,
faceted low-polygon silhouette, simple chunky shapes, small hand-painted low-resolution texture,
matte. Full body, seated pose, front view, plain dark grey background.
```
**3D**
```
low-poly PS2-style seated old king with gold five-point crown, white beard, plain light-grey robe
and cape, gold chain, sword across knees, hand-painted 128px texture, ~1000 triangles, throne not included
```

#### ฮีโร่ 5 วิถี (ตัวที่ผู้เล่นบังคับ)

แยกไว้อีกไฟล์ที่ละเอียดกว่า: **[`HERO_PROMPTS.md`](HERO_PROMPTS.md)** มี turnaround ภาพท่าต่อสู้ prompt 3D อาวุธแยก แบบผู้หญิง และหลักออกแบบให้อ่านออกตอนสู้กันออนไลน์

---

## 5. Checklist หลังได้โมเดล (ทำใน Blender ให้ไม่หลุดสไตล์)

1. **ลด polygon** ด้วย Decimate (Collapse) จนเหลือตามงบในตาราง ให้เห็นเหลี่ยมมุมชัด ไม่ต้องกลัวว่าจะดูหยาบ หยาบแบบนั้นแหละคือสไตล์ PS2
2. **ลดเท็กซ์เจอร์** เหลือ 128×128 (หรือ 256 สำหรับบอส) ด้วย Image → Resize ให้เบลอนิด ๆ และให้ลายแปรงหยาบลง
3. **ตัด PBR ทิ้ง** เหลือ Base Color อย่างเดียว ตั้ง Roughness = 1 และ Metallic = 0
4. **เทียบสีกับภาพอ้างอิง** วางภาพจาก `model-refs/` ข้าง ๆ ถ้าสีสดหรือเนียนกว่ามาก ให้ลด Saturation ลงเล็กน้อย เพราะเกมจะเร่งสีให้อีกที
5. **แยกส่วนเรืองแสง** (ตา เปลวไฟ ตะเกียง) เป็นวัสดุชื่อ `glow` ใช้สีสว่างล้วน ไม่ต้องมีเท็กซ์เจอร์
6. **ตั้งแกน** ให้หันหน้า +Z, origin ที่พื้นระหว่างเท้า, สเกลตามความสูงในตาราง แล้ว Apply Transform
7. Export เป็น **glTF Binary (.glb)** ติ๊ก +Y Up

## 6. Rig สำหรับตัวที่เป็นคน (ร่างซีดทั้ง 4 และฮีโร่)

ระบบท่าทางในเกมใช้กระดูก 16 ชิ้นตามชื่อข้างล่าง ถ้าตั้งชื่อตามนี้ เกมใช้ท่าเดิน วิ่ง คลาน และฟันที่มีอยู่แล้วได้เลย (ตัวเลขเป็นตำแหน่งของมนุษย์สูงประมาณ 1.8 ม. หันหน้า +Z ฝั่ง L อยู่ทาง +X)

| กระดูก | parent | ตำแหน่ง (x, y, z) |
|---|---|---|
| `hips` | — | 0, 0.98, 0 |
| `spine` | hips | 0, 1.12, 0 |
| `chest` | spine | 0, 1.38, 0 |
| `neck` | chest | 0, 1.58, 0.02 |
| `head` | neck | 0, 1.68, 0.04 |
| `shL` / `shR` | chest | ±0.19, 1.52, 0 |
| `elL` / `elR` | shL / shR | ±0.21, 1.17, 0.01 |
| `haL` / `haR` | elL / elR | ±0.22, 0.85, 0.02 |
| `hiL` / `hiR` | hips | ±0.10, 0.94, 0 |
| `knL` / `knR` | hiL / hiR | ±0.11, 0.52, 0.03 |
| `anL` / `anR` | knL / knR | ±0.11, 0.08, 0 |

ถ้าเครื่องมือ AI ทำ auto-rig มาให้ (เช่น Meshy, Tripo) ใช้ได้เลย แค่บอกผมว่ากระดูกชื่ออะไร แล้วผมจะเขียนตัวแปลงชื่อให้
