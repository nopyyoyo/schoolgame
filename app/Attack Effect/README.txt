CURATED V3

This pass uses manually defined fixed grids instead of connected-component frame detection.
- Text-label areas are excluded by grid position and remaining dark-green label pixels are removed.
- Empty or tiny junk cells are discarded, so a label fragment should not become a last frame.
- Every frame in an effect keeps the exact same source-cell dimensions and alignment.
- No per-frame recentering is used, preserving motion offsets from the original sheet.
- CONTACT_SHEET_ALL_EFFECTS.png provides a fast visual review of all exported strips.

The upper named weapon effects received the most conservative grids. Lower unlabeled rows are separated by visual row and color family rather than guessed weapon names.
