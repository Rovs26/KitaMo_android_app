from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUTPUT = ROOT / "docs" / "play-store" / "assets"

GREEN = "#006B3C"
GOLD = "#E3A008"
CORAL = "#F15A3C"
INK = "#10211A"
MUTED = "#526158"
CREAM = "#F7F1E3"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf"),
        Path("/System/Library/Fonts/SFNS.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default(size=size)


def make_feature_graphic(master: Image.Image) -> None:
    image = Image.new("RGB", (1024, 500), master.getpixel((0, 0)))
    draw = ImageDraw.Draw(image)

    draw.rectangle((0, 0, 18, 500), fill=GREEN)
    draw.rectangle((18, 0, 25, 500), fill=GOLD)
    draw.rounded_rectangle((66, 78, 554, 86), radius=4, fill=GOLD)

    title_font = font(78, bold=True)
    tagline_font = font(34, bold=True)
    detail_font = font(22)
    local_font = font(20, bold=True)

    draw.text((68, 100), "Kita", fill=GREEN, font=title_font)
    kita_width = draw.textlength("Kita", font=title_font)
    draw.text((68 + kita_width, 100), "Mo", fill=GOLD, font=title_font)
    draw.text((70, 210), "Kita mo agad ang", fill=INK, font=tagline_font)
    draw.text((70, 250), "negosyo mo.", fill=INK, font=tagline_font)
    draw.text((70, 322), "Benta | Stock | Recipe Costing | Kita Report", fill=MUTED, font=detail_font)

    draw.rounded_rectangle((70, 388, 362, 438), radius=8, fill=GREEN)
    draw.text((92, 402), "LOCAL-FIRST ANDROID", fill="#FFFFFF", font=local_font)
    draw.ellipse((386, 404, 404, 422), fill=CORAL)

    mark = master.resize((390, 390), Image.Resampling.LANCZOS)
    image.paste(mark, (610, 55))
    image.save(OUTPUT / "feature-graphic-1024x500.png", optimize=True)


def make_play_icon(master: Image.Image) -> None:
    master.resize((512, 512), Image.Resampling.LANCZOS).save(
        OUTPUT / "play-icon-512.png",
        optimize=True,
    )


def make_app_assets(master: Image.Image) -> None:
    master.resize((1024, 1024), Image.Resampling.LANCZOS).save(
        ASSETS / "icon.png",
        optimize=True,
    )
    master.resize((512, 512), Image.Resampling.LANCZOS).save(
        ASSETS / "splash-icon.png",
        optimize=True,
    )
    adaptive = Image.new("RGB", (1024, 1024), master.getpixel((0, 0)))
    adaptive_mark = master.resize((768, 768), Image.Resampling.LANCZOS)
    adaptive.paste(adaptive_mark, (128, 128))
    adaptive.save(ASSETS / "adaptive-icon.png", optimize=True)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    master = Image.open(ASSETS / "kitamo-icon-master.png").convert("RGB")
    make_app_assets(master)
    make_feature_graphic(master)
    make_play_icon(master)


if __name__ == "__main__":
    main()
