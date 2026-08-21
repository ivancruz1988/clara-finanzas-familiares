from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "diagramas-proyecto-clara.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)
W, H = landscape(A4)

BG = HexColor("#F4F7F5")
INK = HexColor("#12241F")
GREEN = HexColor("#0B7254")
MINT = HexColor("#E3F4EC")
LINE = HexColor("#A9BDB5")
WHITE = HexColor("#FFFFFF")
AMBER = HexColor("#E8B65F")


def box(c, x, y, w, h, title, subtitle="", fill=WHITE, stroke=LINE):
    c.setFillColor(fill); c.setStrokeColor(stroke); c.setLineWidth(1)
    c.roundRect(x, y, w, h, 7, fill=1, stroke=1)
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(x + w/2, y + h/2 + (4 if subtitle else -3), title)
    if subtitle:
        c.setFillColor(HexColor("#61736C")); c.setFont("Helvetica", 7)
        c.drawCentredString(x + w/2, y + h/2 - 8, subtitle)


def arrow(c, x1, y1, x2, y2):
    c.setStrokeColor(GREEN); c.setFillColor(GREEN); c.setLineWidth(1.4)
    c.line(x1, y1, x2, y2)
    import math
    a = math.atan2(y2-y1, x2-x1)
    s = 5
    c.line(x2, y2, x2-s*math.cos(a-.5), y2-s*math.sin(a-.5))
    c.line(x2, y2, x2-s*math.cos(a+.5), y2-s*math.sin(a+.5))


def header(c, title, page):
    c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(GREEN); c.roundRect(28, H-55, 29, 29, 8, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 18); c.drawCentredString(42.5, H-47, "c")
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 19); c.drawString(67, H-43, title)
    c.setFillColor(HexColor("#61736C")); c.setFont("Helvetica", 8)
    c.drawRightString(W-30, H-42, f"CLARA · FINANZAS FAMILIARES   |   {page}/2")
    c.setStrokeColor(LINE); c.line(28, H-65, W-28, H-65)


c = canvas.Canvas(str(OUT), pagesize=landscape(A4))

# Página 1 - arquitectura
header(c, "Arquitectura general del proyecto", 1)
box(c, 35, 235, 105, 52, "Usuario familiar", "Celular o computadora", MINT, GREEN)
box(c, 35, 135, 105, 52, "Vercel", "Aplicación publicada", WHITE, GREEN)
box(c, 35, 35, 105, 52, "GitHub", "Código y pull requests", WHITE, GREEN)
arrow(c, 87, 235, 87, 187); arrow(c, 140, 161, 183, 161); arrow(c, 140, 61, 183, 125)

c.setFillColor(HexColor("#EAF2EE")); c.setStrokeColor(LINE); c.roundRect(174, 26, 282, 310, 10, fill=1, stroke=1)
c.setFillColor(GREEN); c.setFont("Helvetica-Bold", 11); c.drawString(190, 315, "APLICACIÓN WEB · NEXT.JS")
box(c, 194, 250, 105, 42, "Autenticación")
box(c, 326, 250, 105, 42, "Hogar familiar")
box(c, 260, 184, 105, 42, "Resumen financiero", fill=MINT, stroke=GREEN)
mods=[("Cuentas",190,105),("Categorías",272,105),("Movimientos",354,105),("Presupuesto",231,48),("Pagos",313,48)]
for t,x,y in mods: box(c,x,y,70,36,t)
arrow(c,299,271,326,271); arrow(c,378,250,326,226)
for _,x,y in mods: arrow(c,312,184,x+35,y+36)

c.setFillColor(HexColor("#E6F3ED")); c.setStrokeColor(GREEN); c.roundRect(475, 26, 335, 310, 10, fill=1, stroke=1)
c.setFillColor(GREEN); c.setFont("Helvetica-Bold", 11); c.drawString(491, 315, "SUPABASE")
box(c, 495, 250, 90, 42, "Auth", "Usuarios y sesiones")
box(c, 600, 250, 90, 42, "RPC", "Funciones seguras")
box(c, 705, 250, 80, 42, "RLS", "Seguridad por hogar", MINT, GREEN)
tables=[("households",495,174),("members",590,174),("accounts",685,174),("categories",495,105),("transactions",590,105),("budgets",685,105),("payments",590,40)]
for t,x,y in tables: box(c,x,y,80,35,t)
arrow(c,456,271,495,271); arrow(c,456,271,600,271)
for _,x,y in tables: arrow(c,745,250,x+40,y+35)
c.setFillColor(HexColor("#61736C")); c.setFont("Helvetica", 8)
c.drawString(35, 10, "Seguridad: cada usuario accede únicamente a la información del hogar al que pertenece.")
c.showPage()

# Página 2 - flujo
header(c, "Flujo funcional de la aplicación", 2)
steps=[
    ("1", "Crear usuario", "Email y contraseña"),
    ("2", "Confirmar email", "Validar identidad"),
    ("3", "Iniciar sesión", "Sesión persistente"),
    ("4", "Crear o cargar hogar", "Asignar propietario"),
    ("5", "Configurar finanzas", "Cuentas y categorías"),
    ("6", "Registrar actividad", "Movimientos y pagos"),
    ("7", "Consultar tablero", "Totales y proyección"),
]
xs=[35,148,261,374,487,600,713]
for i,((n,t,s),x) in enumerate(zip(steps,xs)):
    c.setFillColor(GREEN); c.circle(x+45, 274, 13, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 10); c.drawCentredString(x+45,270,n)
    box(c,x,170,90,72,t,s,MINT if i in (3,6) else WHITE,GREEN if i in (3,6) else LINE)
    if i < len(xs)-1: arrow(c,x+90,206,xs[i+1],206)

c.setFillColor(WHITE); c.setStrokeColor(LINE); c.roundRect(90,62,W-180,68,10,fill=1,stroke=1)
c.setFillColor(GREEN); c.setFont("Helvetica-Bold", 11); c.drawString(110,104,"CÁLCULOS PRINCIPALES")
c.setFillColor(INK); c.setFont("Helvetica", 10)
c.drawString(110,84,"Disponible total = suma de los saldos de las cuentas")
c.drawString(440,84,"Disponible proyectado = disponible total - pagos pendientes")
c.setFillColor(HexColor("#61736C")); c.setFont("Helvetica", 8)
c.drawString(35, 25,"Resultado: una única vista familiar para controlar saldos, compromisos, presupuesto y próximos pagos.")
c.showPage(); c.save()
print(OUT)
