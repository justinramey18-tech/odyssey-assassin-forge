

# Custom Ability Images - Implementation Plan

## What We're Building
Allow you to upload personal images to any ability node in your skill trees. These images will also automatically appear on the matching ability cards in the Combat tab - just like how your weapon images already sync between Gear and Combat.

---

## How It Will Work

### Uploading an Image
1. Tap on any ability node in the skill tree
2. The details panel opens on the right
3. Tap the icon/image area at the top of the panel
4. Choose a photo from your device
5. The image instantly appears on that ability node

### Seeing It Everywhere
- **Skill Trees:** Your custom image fills the circular node
- **Combat Tab:** The same image shows up on that ability's card
- **Real-time sync:** Changes appear immediately in both places

### Removing an Image
- Tap the image area again
- A trash icon appears
- Tap to remove and go back to the default icon

---

## What Gets Created/Changed

### New Piece
**Image Storage System** - A behind-the-scenes system (similar to the one already used for weapons) that:
- Saves your ability images to your device's local storage
- Remembers them between sessions
- Limits each image to 2MB to keep things running smoothly

### Updated Screens

**Abilities Tab:**
- The circular ability nodes can now display your custom images
- The details panel gets an upload button in the header area
- Tier badges (I, II, III) stay visible on top of your images

**Combat Tab:**
- Ability cards show your custom images in the icon area
- Falls back to the colored border style when no image exists

---

## Files Involved

| What | Purpose |
|------|---------|
| New image storage hook | Saves/loads images from device storage |
| Ability nodes | Display custom images in the circles |
| Ability details panel | Add upload/remove buttons |
| Abilities screen | Connect everything together |
| Combat ability cards | Show the same images in Combat |
| Combat layout | Wire up the image sync |

---

## End Result
Upload an image to "Predator Sense" in your skill tree → it instantly appears on the Predator Sense card in Combat → images persist even after closing the app.

