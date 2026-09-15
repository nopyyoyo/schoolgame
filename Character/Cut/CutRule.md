# Character Sprite Cutting Rule

Use this rule for character sheets such as `P1S.png`, `P2S.png`, `P3S.png`, and `P4S.png`.

1. Treat the pixel at the top-left of the sheet as the purple background color.
2. The large sprite on the left is the face. Crop it to the smallest rectangle containing every pixel that differs from the background.
3. The remaining sprites are ten actions arranged in two rows of five. Use these source regions:
   - Top row: `x=95..130`, `125..160`, `160..194`, `194..227`, `225..260`; `y=0..39`
   - Bottom row: `x=95..130`, `130..160`, `160..194`, `194..225`, `225..260`; `y=40..79`
4. For each region, find the smallest rectangle containing every non-background pixel. Save the results as:
   - `face.png`
   - `action_01.png` through `action_10.png`
5. Place the outputs in a folder named `<sheet-name>_Cut` beside the source sheet.
6. The bottom-row fourth action (`action_09`) must not include pixels from the neighboring fifth action. Its source region ends at `x=225` (exclusive in implementation); never extend that crop into the fifth action.
7. Preserve the original PNG files and retain pixel-art sharpness; do not resize, smooth, or recolor the sprites.
