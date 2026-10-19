import os
from PIL import Image, ImageDraw, ImageFont

def create_sidebar_bmp(output_path, logo_path):
    # Dimensions for NSIS MUI2 welcome/finish sidebar: 164 x 314
    width, height = 164, 314
    img = Image.new('RGB', (width, height), color='#070c0a')
    draw = ImageDraw.Draw(img)

    # 1. Subtle acoustic dot grid background
    dot_color = (23, 163, 152, 35) # faint teal
    for x in range(6, width, 12):
        for y in range(6, height, 12):
            draw.point((x, y), fill=(18, 38, 34))

    # 2. Ambient radial glow behind the top logo
    center_x, center_y = width // 2, 60
    for r in range(55, 10, -5):
        alpha_factor = (55 - r) / 45.0
        glow_color = (
            int(7 + (23 - 7) * alpha_factor * 0.4),
            int(12 + (163 - 12) * alpha_factor * 0.4),
            int(10 + (152 - 10) * alpha_factor * 0.4)
        )
        draw.ellipse([center_x - r, center_y - r, center_x + r, center_y + r], outline=glow_color)

    # 3. Paste Rivo App Icon
    if os.path.exists(logo_path):
        icon = Image.open(logo_path).convert('RGBA')
        icon_size = 56
        icon = icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        # Paste with alpha
        img.paste(icon, (center_x - icon_size // 2, center_y - icon_size // 2), icon)

    # 4. Border frame around icon
    draw.rounded_rectangle(
        [center_x - 32, center_y - 32, center_x + 32, center_y + 32],
        radius=14,
        outline='#17a398',
        width=2
    )

    # 5. Try to load fonts or fallback
    try:
        font_title = ImageFont.truetype("arialbd.ttf", 18)
        font_badge = ImageFont.truetype("consola.ttf", 9)
        font_sub = ImageFont.truetype("arialbd.ttf", 9)
        font_tiny = ImageFont.truetype("consola.ttf", 8)
    except:
        font_title = ImageFont.load_default()
        font_badge = font_title
        font_sub = font_title
        font_tiny = font_title

    # "RIVO" text
    title_text = "R I V O"
    bbox = draw.textbbox((0, 0), title_text, font=font_title)
    t_w = bbox[2] - bbox[0]
    draw.text(((width - t_w) // 2, 102), title_text, fill='#ffffff', font=font_title)

    # Stereo Pill Badge
    badge_text = "HI-FI STEREO DECK"
    bbox = draw.textbbox((0, 0), badge_text, font=font_badge)
    b_w = bbox[2] - bbox[0]
    badge_x = (width - b_w) // 2
    draw.rounded_rectangle([badge_x - 6, 126, badge_x + b_w + 5, 140], radius=4, fill='#17a398')
    draw.text((badge_x, 128), badge_text, fill='#070c0a', font=font_badge)

    # Separator with glowing center
    draw.line([(20, 150), (width - 20, 150)], fill='#182824', width=1)
    draw.line([(width // 2 - 25, 150), (width // 2 + 25, 150)], fill='#26c4b7', width=1)

    # Equalizer Spectrum Visualizer Bars
    eq_bars = [12, 22, 35, 18, 42, 28, 38, 20, 45, 30, 24, 15]
    bar_width = 7
    gap = 4
    total_bars_width = len(eq_bars) * bar_width + (len(eq_bars) - 1) * gap
    start_x = (width - total_bars_width) // 2
    base_y = 210

    for i, h in enumerate(eq_bars):
        bx = start_x + i * (bar_width + gap)
        # Gradient bar
        for seg in range(h):
            sy = base_y - seg
            ratio = seg / 45.0
            r = int(23 + (38 - 23) * ratio)
            g = int(163 + (196 - 163) * ratio)
            b = int(152 + (183 - 152) * ratio)
            draw.line([(bx, sy), (bx + bar_width - 1, sy)], fill=(r, g, b))
        # Peak dot
        draw.line([(bx, base_y - h - 3), (bx + bar_width - 1, base_y - h - 3)], fill='#ffffff')

    # EQ Level markers
    draw.text((start_x, base_y + 4), "CH-L", fill='#17a398', font=font_tiny)
    draw.text((start_x + total_bars_width - 20, base_y + 4), "CH-R", fill='#17a398', font=font_tiny)

    # Feature List Box
    box_top = 232
    draw.rounded_rectangle([14, box_top, width - 14, box_top + 62], radius=6, outline='#182824', fill='#0b1412', width=1)
    
    draw.text((22, box_top + 8), "• 24-BIT MASTER AUDIO", fill='#e2f8f5', font=font_sub)
    draw.text((22, box_top + 23), "• SYNCED LYRICS ENGINE", fill='#96dfd7', font=font_sub)
    draw.text((22, box_top + 38), "• OFFLINE HI-RES CACHE", fill='#26c4b7', font=font_sub)

    # Bottom Stereo Tape Accent
    draw.rectangle([0, height - 6, width, height], fill='#17a398')
    draw.rectangle([0, height - 3, width, height], fill='#26c4b7')

    # Save as standard 24-bit uncompressed BMP
    img.save(output_path, format='BMP')
    print(f"Created sidebar image: {output_path} ({width}x{height})")


def create_header_bmp(output_path, logo_path):
    # Dimensions for NSIS MUI2 header: 150 x 57
    width, height = 150, 57
    img = Image.new('RGB', (width, height), color='#070c0a')
    draw = ImageDraw.Draw(img)

    # Subtle acoustic dot grid
    for x in range(4, width, 10):
        for y in range(4, height, 10):
            draw.point((x, y), fill=(18, 38, 34))

    # Right side: Logo
    center_x, center_y = width - 30, height // 2
    if os.path.exists(logo_path):
        icon = Image.open(logo_path).convert('RGBA')
        icon_size = 38
        icon = icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        img.paste(icon, (center_x - icon_size // 2, center_y - icon_size // 2), icon)

    # Border frame around header icon
    draw.rounded_rectangle(
        [center_x - 21, center_y - 21, center_x + 21, center_y + 21],
        radius=8,
        outline='#17a398',
        width=1
    )

    try:
        font_title = ImageFont.truetype("arialbd.ttf", 13)
        font_badge = ImageFont.truetype("consola.ttf", 8)
    except:
        font_title = ImageFont.load_default()
        font_badge = font_title

    # Left side: Brand
    draw.text((12, 12), "R I V O", fill='#ffffff', font=font_title)
    
    # Badge
    draw.rounded_rectangle([12, 32, 86, 44], radius=3, fill='#17a398')
    draw.text((16, 33), "24-BIT MASTER", fill='#070c0a', font=font_badge)

    # Subtle mini EQ bars next to logo
    eq_bars = [6, 14, 20, 10, 18, 12]
    for i, h in enumerate(eq_bars):
        bx = 94 + i * 4
        by = 38
        draw.line([(bx, by), (bx, by - h)], fill='#26c4b7', width=2)

    # Bottom line
    draw.line([(0, height - 1), (width, height - 1)], fill='#17a398', width=1)

    # Save as standard 24-bit uncompressed BMP
    img.save(output_path, format='BMP')
    print(f"Created header image: {output_path} ({width}x{height})")


if __name__ == '__main__':
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    icon_png = os.path.join(base_dir, 'src-tauri', 'icons', 'icon.png')
    sidebar_out = os.path.join(base_dir, 'src-tauri', 'icons', 'installer-sidebar.bmp')
    header_out = os.path.join(base_dir, 'src-tauri', 'icons', 'installer-header.bmp')

    create_sidebar_bmp(sidebar_out, icon_png)
    create_header_bmp(header_out, icon_png)
