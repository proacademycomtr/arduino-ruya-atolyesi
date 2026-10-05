#!/usr/bin/env bash
# ── Arduino Rüya Atölyesi — yayınlama script'i ──
# Kullanım:
#   ./publish.sh            → mevcut sürümle derle, gh-pages dalını güncelle, push
#   ./publish.sh 2.16.0     → sürümü yükselt (CHANGELOG'a ekler), derle, yayınla
#
# Adımlar: node --test → build.py → gh-pages worktree'üne dist kopyala + .nojekyll
#          → commit + push (main + gh-pages)
set -euo pipefail
cd "$(dirname "$0")"
# `dist/` göreli yol; aşağıda worktree'ye cd ediliyor, orada kaybolmasın.
DIST_DIR="$PWD/dist"

VERSION_ARG="${1:-}"

echo "🧪 Testler çalıştırılıyor…"
node --test tests/ > /dev/null
echo "✅ Testler geçti"

if [ -n "$VERSION_ARG" ]; then
  echo "🏗️  Sürüm $VERSION_ARG ile derleniyor…"
  python3 build.py "$VERSION_ARG"
else
  echo "🏗️  Mevcut sürümle derleniyor…"
  python3 build.py
fi

echo "📦 gh-pages dalı güncelleniyor…"
# Bayat worktree kalıntısı varsa temizle (add başarısız olursa rsync yanlış ağaca gider)
git worktree remove --force /tmp/agh-pages 2>/dev/null || rm -rf /tmp/agh-pages
git worktree prune
# `add` başarısız olursa rsync sessizce yanlış/eskimiş bir ağaca yazabiliyor;
# bu yüzden başarısızlık burada DURDURULUYOR (eskiden `|| true` yutuyordu).
if ! git worktree add /tmp/agh-pages gh-pages; then
  echo "❌ gh-pages worktree'i oluşturulamadı — yayınlamadım" >&2
  exit 1
fi
rsync -a --delete --exclude '.git' "$DIST_DIR/" /tmp/agh-pages/
# README görselleri gibi repo varlıkları da yayına girsin (docs/ vb.)
if [ -d "$PWD/docs" ]; then mkdir -p /tmp/agh-pages/docs; rsync -a "$PWD/docs/" /tmp/agh-pages/docs/; fi
touch /tmp/agh-pages/.nojekyll
cd /tmp/agh-pages
# Yayına giren sürüm, build.py'nin ürettiği sürümle AYNI olmalı. Önceden
# "değişiklik yok" denince ekran çıktısına bakılmadan geçiliyordu; aslında
# worktree yanlış ağaca yazılmış, sürüm eski kalmıştı.
DAHA_YENI="$(grep -o 'APP_VERSION = "[^"]*"' "$DIST_DIR/index.html" | head -1 | cut -d'"' -f2)"
YAYIMDAKI="$(grep -o 'APP_VERSION = "[^"]*"' index.html | head -1 | cut -d'"' -f2)"
if [ -n "$DAHA_YENI" ] && [ "$DAHA_YENI" != "$YAYIMDAKI" ]; then
  echo "❌ Sürüm uyuşmuyor: derlenen $DAHA_YENI, worktree'de $YAYIMDAKI — yayınlamadım" >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -q -m "Pages yayını: dist güncel

🤖 Generated with Codebuff
Co-Authored-By: Codebuff <noreply@codebuff.com>" || true
  git push origin gh-pages
  echo "✅ gh-pages push edildi"
else
  echo "ℹ️  gh-pages zaten güncel"
fi
cd - > /dev/null
git worktree remove /tmp/agh-pages --force 2>/dev/null || true

echo "⬆️  main push ediliyor…"
git push origin main
echo "🎉 Yayın tamam: https://proacademycomtr.github.io/arduino-ruya-atolyesi/"
