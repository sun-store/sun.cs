# sun.support: brand kit for agents

Read this file first. It is the single source of truth for the name, logo and visual rules of the sun.support app.

## 1. Product

- **Name:** `sun.support` (always lowercase, with the dot). Never "Sun Support", "SunSupport", "sun.cs" or "sun-support" in UI copy.
- **What it is:** the customer service app of sun.store, Europe's B2B marketplace for PV products.
- **Users now:** the internal sun.store CS team, working with sellers and buyers.
- **Users later (possible):** sellers and buyers directly. The name was chosen to work for both.
- **Family:** sun.store (marketplace), sun.finance (financing), sun.support (customer service). Pattern: `sun.` + one plain word.
- **Former working name:** sun.cs. Retired. Do not use it.

## 2. Status

Draft v3, 28.09.2026. Not yet approved by sun.store marketing. The app icon modifies the official logomark (see 5.3), which the brandbook forbids without approval. Use the assets for internal builds and prototypes. Do not publish externally before sign-off.

## 3. Files

```
logo/
  sunstore_logo_sun-support_lockup-black_v3.svg/.png   light backgrounds
  sunstore_logo_sun-support_lockup-white_v3.svg/.png   dark backgrounds / photos
app-icon/
  sunstore_app-icon_sun-support_dark_v3.svg             primary icon (black tile)
  sunstore_app-icon_sun-support_light_v3.svg            secondary icon (white tile)
  *_1024/512/180/64/32/16.png                           raster sizes (180 = apple-touch-icon)
fonts/
  Aeonik-Regular.otf, Aeonik-Medium.otf, Aeonik-Bold.otf
preview/
  sun-support_preview_v3.png                            overview of all assets
tokens.css                                              colours, fonts, type scale
```

SVGs are vector, text converted to outlines. They render correctly without the font installed. Prefer SVG everywhere; use PNG only where SVG is not accepted.

Aeonik is a commercial typeface licensed by sun.store. Use it only in sun.store projects. Do not redistribute it or put it in public repositories.

## 4. Colours (the entire palette, add no others)

| Token | HEX | Use |
|---|---|---|
| Green | `#2EBB6F` | Primary accent: key CTAs, positive states, one emphasised phrase |
| Yellow | `#F6D736` | Logomark and decorative geometry only. Never text colour |
| Black | `#000000` | Headlines and body text, dark surfaces |
| White | `#FFFFFF` | Default background, text on dark |
| Gray | `#F8F8F8` | Panels, chips, section backgrounds |
| Body | `#727487` | Sparingly: small labels, captions, metadata |

No other greys, no blues. To darken a photo, overlay `rgba(0,0,0,x)`.

## 5. Logo

### 5.1 Lockup
Official sun.store logomark + "sun." in Aeonik Bold + "support" in Aeonik Regular. Same construction as the sun.store wordmark.

- Black lockup on White or Gray. White lockup on Black or photos. The logomark stays yellow in both.
- Clear space on all sides: at least the height of the logomark.
- Minimum height: 16 px.
- Do not recolour, stretch, rotate, add shadows or effects, or retype the name in a live font.

### 5.2 Where to use what
- Lockup: app header, login screen, emails, documents.
- App icon: home screen, favicon, taskbar, app stores. Never put the lockup inside the icon.

### 5.3 App icon
The sun logomark forms a speech bubble: the bottom ray is lengthened and tilted left into a bubble tail. Meaning: "sun.store you can talk to". The centre stays empty on purpose.

- Default: **dark** version (black tile). Yellow on white has weak contrast, so use the light version only where a white tile is required.
- Tile corner radius is built in (224/1024). If a platform applies its own mask (iOS, Android adaptive), use a square export without the rounded tile. Ask for one if needed.
- Do not add dots, letters, badges or a second symbol inside the ring.

### 5.4 Known limits
- At 16 px the tail is barely visible. For favicons use the 32 px file where possible. A simplified small-size mark is still to be designed.

## 6. Typography

- Aeonik only. Fallback: `'Inter', 'DM Sans', sans-serif`.
- Medium (500) for headings and emphasis, Regular (400) for body. Bold only inside the logo.
- 8 px scale. Web: H1 48, H2 40, H3 32, H4 24 (Medium); Body 18 and 16 (Regular).
- Line height: headings 1.1 to 1.25, body 1.4 to 1.5.

## 7. UI basics

- Primary button: Green `#2EBB6F` background, white text, radius up to 8 px.
- Secondary button: 1 px black border, black text, transparent background.
- Cards: White or Gray `#F8F8F8`, subtle shadow.
- Lots of white space, one clear message per screen.

## 8. Voice

British English (or Polish for the PL team). Clear, professional, confident, never hype. Short sentences. Avoid "game-changing", "revolutionary", "cutting-edge". No filler greetings.

## 9. Decisions log

- Name sun.cs rejected: an abbreviation that breaks the `sun.` + word pattern, internal jargon, collides with the Czech language code "cs", and is hard to say.
- Names rejected: sun.desk (internal only), sun.chat (too narrow), sun.help, sun.care.
- Icon ideas rejected: three dots in the centre (read as "speechless"), two half circles (read as an eye), check mark (reads as a to-do app).

## 10. Open items

1. Marketing sign-off on the modified logomark (icon).
2. Simplified mark for 16 px.
3. Square, unrounded icon exports for platform masks.
