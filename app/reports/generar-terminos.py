from pathlib import Path
import html
import re

folder = Path(__file__).parent
source = folder / 'Terminos-Condiciones-Zona-Cero.md'

def inline(text):
    text = html.escape(text)
    text = re.sub(r'\[([^\]]+)\]\((https://[^)]+)\)', r'<a href="\2">\1</a>', text)
    return re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)

parts = []
toc = []
paragraph = []
in_list = False

def flush():
    if paragraph:
        parts.append('<p>' + inline(' '.join(paragraph)) + '</p>')
        paragraph.clear()

for line in source.read_text().splitlines():
    if not line.startswith('- ') and in_list:
        parts.append('</ul>')
        in_list = False
    if line.startswith('# '):
        flush()
        parts.append('<h1>' + inline(line[2:]) + '</h1>')
    elif line.startswith('## '):
        flush()
        anchor = f'section-{len(toc) + 1}'
        toc.append(f'<li><a href="#{anchor}">{inline(line[3:])}</a></li>')
        parts.append(f'<h2 id="{anchor}">{inline(line[3:])}</h2>')
    elif line.startswith('- '):
        flush()
        if not in_list:
            parts.append('<ul>')
            in_list = True
        parts.append('<li>' + inline(line[2:]) + '</li>')
    elif not line.strip():
        flush()
    else:
        paragraph.append(line)
flush()
if in_list:
    parts.append('</ul>')

document = '''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Condiciones de uso de la aplicación Zona Cero: cuenta, seguridad, membresías, pagos, reservas y protección de datos personales."><title>Zona Cero · Términos y condiciones de la aplicación</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf2f6;color:#1a2c3d;font:16px/1.8 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:1000px;margin:32px auto;padding:56px 64px;background:white;border-radius:18px}.brand{color:#007c6b;font-weight:800;letter-spacing:.2em}header{border-bottom:2px solid #007c6b;padding-bottom:20px;margin-bottom:24px}header p{color:#526576;font-size:14px}h1{font-size:32px;line-height:1.25;max-width:750px}h2{font-size:21px;line-height:1.45;margin-top:36px;border-bottom:1px solid #dae3e9;padding-bottom:10px;scroll-margin-top:20px}article p,article li{text-align:justify;text-justify:inter-word;hyphens:auto;overflow-wrap:break-word}article p{margin:16px 0}a{color:#006b61;text-underline-offset:3px}details{background:#f1f6f6;padding:16px 24px;border-radius:12px;margin:24px 0}summary{cursor:pointer;font-weight:650}nav ol{columns:2;column-gap:32px;padding-left:22px}nav li{break-inside:avoid;font-size:14px;margin:8px 0;text-align:left}li{margin:10px 0}footer{margin-top:40px;border-top:1px solid #dae3e9;padding-top:15px;font-size:13px;color:#526576}button{background:#007c6b;color:white;border:0;border-radius:8px;padding:12px 20px;font:inherit;cursor:pointer;min-height:44px}@media(max-width:650px){main{margin:0;padding:24px;border-radius:0}h1{font-size:27px}h2{font-size:20px}nav ol{columns:1}}@page{size:A4;margin:20mm}@media print{body{background:white;font-size:11pt;line-height:1.65}main{margin:0;padding:0;max-width:none}button,details{display:none}header{margin-bottom:20px}h1{font-size:24pt}h2{font-size:14pt;break-after:avoid}p,li{orphans:3;widows:3}a{color:inherit}footer{font-size:9pt}}
</style></head><body><main><header><div class="brand">ZONA CERO</div>'''
document += ''.join(parts[:2]) + '</header><button type="button" onclick="window.print()">Imprimir o guardar como PDF</button>'
document += '<details><summary>Índice de términos y condiciones</summary><nav aria-label="Índice del documento"><ol>' + ''.join(toc) + '</ol></nav></details>'
document += '<article aria-label="Condiciones de uso de la aplicación">' + ''.join(parts[2:]) + '</article>'
document += '<footer>Zona Cero Performance Center · Términos y condiciones de la aplicación · Versión documental 1.0.</footer></main></body></html>'
target = folder / 'Terminos-Condiciones-Zona-Cero.html'
target.write_text(document)
# Actualiza también el archivo compartido anteriormente.
(folder / 'Terminos-Condiciones-Zona-Cero-Borrador.html').write_text(document)
print(f'HTML generado: {target}')
