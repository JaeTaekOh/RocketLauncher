#!/usr/bin/env bash
# Build the GitHub Pages tree in docs/ (marketing site is authored there;
# docs/app/ is a static copy of the web app).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOC="$ROOT/docs"
APP="$DOC/app"

mkdir -p "$DOC/assets" "$DOC/css" "$DOC/js" "$DOC/fonts"
touch "$DOC/.nojekyll"

# Marketing-site fonts and images (owned in repo under fonts/ and assets/).
cp -f "$ROOT/fonts/geist/Geist.woff2" "$DOC/fonts/Geist.woff2"
cp -f "$ROOT/fonts/gothic-a1/GothicA1-Regular.woff2" "$DOC/fonts/GothicA1-Regular.woff2"
cp -f "$ROOT/fonts/gothic-a1/GothicA1-Medium.woff2" "$DOC/fonts/GothicA1-Medium.woff2"
cp -f "$ROOT/assets/icon.jpg" "$DOC/assets/icon.jpg"
cp -f "$ROOT/assets/favicon.svg" "$DOC/assets/favicon.svg"
if [[ -f "$ROOT/assets/readme/hero.png" ]]; then
  cp -f "$ROOT/assets/readme/hero.png" "$DOC/assets/og.png"
fi

# Web app copy
rm -rf "$APP"
mkdir -p "$APP/css" "$APP/js" "$APP/assets" \
  "$APP/fonts/geist" "$APP/fonts/gothic-a1" "$APP/fonts/plex-thai"

cp -f "$ROOT/index.html" "$ROOT/privacy.html" "$APP/"
cp -f "$ROOT/css/"*.css "$APP/css/"
cp -f "$ROOT/js/"*.js "$APP/js/"
cp -f "$ROOT/assets/icon.jpg" "$ROOT/assets/favicon.svg" "$APP/assets/"
cp -f "$ROOT/fonts/geist/"*.woff2 "$APP/fonts/geist/"
cp -f "$ROOT/fonts/gothic-a1/"*.woff2 "$APP/fonts/gothic-a1/"
cp -f "$ROOT/fonts/plex-thai/"*.woff2 "$APP/fonts/plex-thai/"
cp -f "$ROOT/fonts/LICENSES" "$APP/fonts/LICENSES"

# Root privacy page: reuse the app policy, with font paths for the marketing site.
python3 - "$ROOT/privacy.html" "$DOC/privacy.html" << 'PY'
import pathlib, sys, re
src, dst = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
t = src.read_text()
t = t.replace('<link rel="stylesheet" href="css/fonts.css">',
              '<link rel="icon" href="assets/favicon.svg" type="image/svg+xml"><style>'
              '@font-face{font-family:Geist;src:url("fonts/Geist.woff2") format("woff2");font-weight:100 900;font-display:swap}'
              '@font-face{font-family:"Gothic A1";src:url("fonts/GothicA1-Regular.woff2") format("woff2");font-weight:400;font-display:swap}'
              '@font-face{font-family:"Gothic A1";src:url("fonts/GothicA1-Medium.woff2") format("woff2");font-weight:500;font-display:swap}'
              '</style>')
t = t.replace('<body>',
              '<body>\n<p style="margin:0 0 24px"><a href="./" style="color:#6B6B6B;text-decoration:none">← Rocket Launcher</a></p>',
              1)
dst.write_text(t)
print('wrote', dst)
PY

echo "Built $APP"

# Cache-busting: append ?v=<build time> to local CSS/JS links so updates show without a hard refresh.
V="$(date +%Y%m%d%H%M%S)"
for f in "$DOC/index.html" "$APP/index.html" "$DOC/privacy.html" "$APP/privacy.html"; do
  [[ -f "$f" ]] || continue
  sed -i -E "s#((href|src)=\"[^\"?:]+\.(css|js))(\?v=[0-9]+)?\"#\1?v=$V\"#g" "$f"
done
