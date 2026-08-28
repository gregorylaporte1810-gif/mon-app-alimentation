from pathlib import Path
import re

path = Path("index.html")
html = path.read_text(encoding="utf-8")

# Headings cannot be children of <label>; keep the visual heading and make
# the label its phrasing-content child instead.
pattern = re.compile(
    r'<label for="([^"]+)">\s*<h3>(.*?)</h3>\s*</label>',
    flags=re.S,
)
html, count = pattern.subn(r'<h3><label for="\1">\2</label></h3>', html)
if count != 5:
    raise RuntimeError(f"Expected 5 filter labels to normalize, found {count}.")

# A hidden preview still needs a valid src in HTML. JavaScript replaces this
# tiny transparent data URI as soon as the user selects a photo.
old = '<img id="w2-photo-preview" class="w2-photo-preview" alt="Aperçu du repas" hidden>'
new = (
    '<img id="w2-photo-preview" class="w2-photo-preview" alt="Aperçu du repas" hidden '
    'src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'
)
if old not in html:
    raise RuntimeError("Photo preview image marker not found.")
html = html.replace(old, new, 1)

path.write_text(html, encoding="utf-8")
print("✅ 6 strict HTML validation findings corrected.")
