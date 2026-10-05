#!/usr/bin/env python3
"""Arduino Rüya Atölyesi — Derleme Betiği

Kaynak dosyaları (index.html + style.css + app.js) tek dosyalık bir
dağıtım sürümüne birleştirir: dist/index.html

- Kaynak sürüm: index.html + style.css + app.js (ayrı dosyalar, klasik yapı)
- Dağıtım sürümü: dist/index.html (CSS + JS gömülü; GitHub Pages'te
  yan dosya sorunu yaşamadan çalışan tek dosya)

Sürüm yönetimi:
    python3 build.py              → mevcut sürümle derle + CHANGELOG kontrolü
    python3 build.py 2.1.0        → sürümü 2.1.0 yap, CHANGELOG'a ekle, derle
    python3 build.py --bump minor → 2.1.0 → 2.2.0 (patch için --bump patch)

Kullanım:
    python3 build.py
"""
import os
import pathlib
import re
import shutil
import sys
from datetime import date

# ── Sürüm sabiti: yeni sürüm buradan değiştirilir ──
VERSION = "4.1.0"

# v4.0.0: Üyelik/duvar API'sinin adresi.
#   API_BASE=  boş  → API kapalı; uygulama eskisi gibi yalnız demo modda çalışır
#   API_BASE=  dolu → dist/config.js yazılır ve JS'e gömülür
# CI/CD'de: API_BASE=https://ornek.com python3 build.py 4.0.0
API_BASE = (os.environ.get("API_BASE") or "").strip().rstrip("/")

root = pathlib.Path(__file__).parent
changelog_path = root / "CHANGELOG.md"


def bump_version(ver: str, part: str) -> str:
    major, minor, patch = (int(x) for x in ver.split("."))
    if part == "major":
        return f"{major + 1}.0.0"
    if part == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


def update_changelog(new_version: str) -> bool:
    """CHANGELOG.md'ye yeni sürüm girdisi ekler; dosya yoksa oluşturur."""
    today = date.today().isoformat()
    header = "# Changelog\n\nBu dosya `build.py` tarafından otomatik güncellenir.\n"
    entry = f"## [{new_version}] - {today}\n\n- Sürüm {new_version} olarak derlendi.\n"
    if not changelog_path.exists():
        changelog_path.write_text(header + "\n" + entry, encoding="utf-8")
        print(f"📝 CHANGELOG.md oluşturuldu ({new_version})")
        return True
    content = changelog_path.read_text(encoding="utf-8")
    if f"## [{new_version}]" in content:
        # Aynı sürüm zaten var — tekrar ekleme
        return False
    # "# Changelog" başlığından sonra ilk "## [...]" girdisinin üstüne ekle
    m = re.search(r"^## \[", content, flags=re.M)
    if m:
        updated = content[: m.start()] + entry + "\n" + content[m.start():]
    else:
        # Başlık yoksa/başka yapıdaysa: dosyanın sonuna ekle
        updated = content.rstrip("\n") + "\n\n" + entry
    changelog_path.write_text(updated, encoding="utf-8")
    print(f"📝 CHANGELOG.md güncellendi → {new_version}")
    return True


def main() -> None:
    args = sys.argv[1:]
    global VERSION

    # Sürüm argümanı: "2.1.0" | "--bump minor|patch|major"
    if args and re.fullmatch(r"\d+\.\d+\.\d+", args[0]):
        VERSION = args[0]
        args = args[1:]
    elif args and args[0] == "--bump":
        part = args[1] if len(args) > 1 else "patch"
        if part not in ("major", "minor", "patch"):
            raise SystemExit(f"HATA: Geçersiz bump türü: {part} (major|minor|patch)")
        VERSION = bump_version(VERSION, part)
        args = args[2:]

    version_changed = update_changelog(VERSION)

    html = (root / "index.html").read_text(encoding="utf-8")
    css = (root / "style.css").read_text(encoding="utf-8")
    js = (root / "app.js").read_text(encoding="utf-8")

    # Depodaki varsayılan fiyat katalogunu JS'e göm (v2.14.0):
    # uygulama FILE_CATALOG'u yükleyip fiyat önceliğinde "özel → depo → gömülü" sırasını izler.
    catalog_path = root / "fiyat-katalogu.json"
    if catalog_path.exists():
        catalog_js = (
            catalog_path.read_text(encoding="utf-8")
            .replace("\\", "\\\\")
            .replace("`", "\\`")
            .replace("${", "\\${")
        )
        js = f"const FILE_CATALOG = JSON.parse(`{catalog_js}`);\n" + js

    LINK_TAG = '  <link rel="stylesheet" href="style.css" />'
    SCRIPT_TAG = '  <script src="app.js"></script>'

    if LINK_TAG not in html:
        raise SystemExit("HATA: index.html içinde stylesheet bağlantısı bulunamadı — kaynak dosya bozulmuş olabilir.")
    if SCRIPT_TAG not in html:
        raise SystemExit("HATA: index.html içinde app.js bağlantısı bulunamadı — kaynak dosya bozulmuş olabilir.")

    # Sürüm numarasını JS'e göm: "const APP_VERSION" zaten varsa değerini güncelle
    if re.search(r"const APP_VERSION\s*=", js):
        js = re.sub(r"const APP_VERSION\s*=\s*\"[^\"]*\"", f"const APP_VERSION = \"{VERSION}\"", js)
    else:
        js = f'const APP_VERSION = "{VERSION}";\n' + js

    # API adresini JS'e göm. dist/config.js (varsa) bunu eşsiz yazar,
    # yani dağıtım sonrası yeniden derlemeden adres değiştirilebilir.
    if re.search(r"const API_BASE_DEFAULT\s*=", js):
        js = re.sub(r"const API_BASE_DEFAULT\s*=\s*\"[^\"]*\"", f'const API_BASE_DEFAULT = "{API_BASE}"', js)
    else:
        js = f'const API_BASE_DEFAULT = "{API_BASE}";\n' + js

    # Sayfa başlığına sürümü ekle (zaten yoksa)
    title_m = re.search(r"<title>(.*?)</title>", html)
    if title_m:
        base_title = re.sub(r"\s*v\d+\.\d+\.\d+$", "", title_m.group(1))
        html = html.replace(title_m.group(0), f"<title>{base_title} v{VERSION}</title>", 1)

    out = html.replace(LINK_TAG, "  <style>\n" + css + "\n  </style>")
    out = out.replace(SCRIPT_TAG, "  <script>\n" + js + "\n  </script>")

    # Changelog'u modal için HTML olarak göm (window.__CHANGELOG_HTML)
    changelog_html = ""
    if changelog_path.exists():
        md = changelog_path.read_text(encoding="utf-8")
        html_lines = []
        in_list = False
        for raw in md.splitlines():
            line = raw.rstrip()
            if line.startswith("## "):
                if in_list:
                    html_lines.append("</ul>")
                    in_list = False
                html_lines.append("<h2>" + line[3:].strip() + "</h2>")
            elif line.startswith("- "):
                if not in_list:
                    html_lines.append("<ul>")
                    in_list = True
                html_lines.append("<li>" + line[2:].strip() + "</li>")
            elif line.strip() and not line.startswith("#"):
                if in_list:
                    html_lines.append("</ul>")
                    in_list = False
                html_lines.append("<p>" + line.strip() + "</p>")
        if in_list:
            html_lines.append("</ul>")
        changelog_html = "".join(html_lines)
    changelog_js = changelog_html.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
    out = out.replace(
        "  </script>",
        '  window.__CHANGELOG_HTML = "' + changelog_js + '";\n  </script>',
        1,
    )

    dist_dir = root / "dist"
    dist_dir.mkdir(exist_ok=True)
    (dist_dir / "index.html").write_text(out, encoding="utf-8")

    # PWA dosyalarını dist'e kopyala (sw.js'e sürüm işlenir)
    for pwa in ("manifest.json", "icon.svg", "fiyat-katalogu.json"):
        src = root / pwa
        if src.exists():
            shutil.copyfile(src, dist_dir / pwa)
    sw_src = root / "sw.js"
    if sw_src.exists():
        sw_text = sw_src.read_text(encoding="utf-8")
        sw_text = re.sub(r"arduino-ruya-atolyesi-v[\d.]+", f"arduino-ruya-atolyesi-v{VERSION}", sw_text)
        (dist_dir / "sw.js").write_text(sw_text, encoding="utf-8")
    if changelog_path.exists():
        shutil.copyfile(changelog_path, dist_dir / "CHANGELOG.md")

    # v4.0.0: Runtime yapılandırma. Tek dosya dağıtımı bozulmaz — dosya yoksa
    # uygulama API_BASE_DEFAULT'a düşer, o da boşsa API'ye hiç gitmez.
    config_js = (
        "/* Arduino Rüya Atölyesi — çalışma zamanı yapılandırması.\n"
        "   Bu dosyayı düzenleyerek API adresini yeniden derlemeden değiştirebilirsin. */\n"
        f'window.APP_CONFIG = Object.assign({{}}, window.APP_CONFIG, {{ apiBase: "{API_BASE}" }});\n'
    )
    (dist_dir / "config.js").write_text(config_js, encoding="utf-8")

    print(f"✅ dist/index.html yazıldı ({len(out):,} karakter)")
    print(f"   - Sürüm: v{VERSION}" + ("" if version_changed else " (CHANGELOG girdisi zaten var)"))
    print("   - CSS:", f"{len(css):,}", "karakter gömüldü")
    print("   - JS :", f"{len(js):,}", "karakter gömüldü")
    print("   - API:", API_BASE or "(kapalı — yalnız demo mod)")


if __name__ == "__main__":
    main()
