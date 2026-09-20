"""
AIO Screener API 가이드 + 초기 설정 방법 PDF 생성
- 한글 폰트: Malgun Gothic (Windows 기본)
- v56 재작성 기준. P1151~P1155 반영:
    * 공유(운영자) 자격증명과 사용자별 자격증명의 구분을 먼저 설명한다.
    * FRED / BOK ECOS / KOSIS 는 공유 Worker 의 /relay 가 운영자 키로 대신 조회하므로
      사용자가 키를 넣을 필요가 없다(넣어도 개인 Worker 가 없으면 예전엔 동작하지 않았다).
    * 폐기된 안내를 제거했다 — IndexedDB 자동 백업 / AIO.recoverApiKeysFromIdb() /
      "Perplexity 는 필수" 서술.
    * Perplexity · Google CSE 는 v56 부터 사이드바 입력란이 실제로 존재한다.
- 실행: python aio_api_setup_guide.py
"""
import os

from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

GUIDE_VERSION = "v56"

# ── 한글 폰트 등록 ──
pdfmetrics.registerFont(TTFont('Malgun', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('MalgunBd', 'C:/Windows/Fonts/malgunbd.ttf'))
from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily('Malgun', normal='Malgun', bold='MalgunBd', italic='Malgun', boldItalic='MalgunBd')

# 배포본과 같은 위치(저장소 루트)에 쓴다. 재생성하면 실제로 배포되는 PDF 가 갱신된다.
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "AIO_Screener_API_Setup_Guide.pdf")

SITE_URL = "https://ysnle.github.io/aio-screener/"

# ── 색상 ──
COLOR_PRIMARY = colors.HexColor('#00d4ff')      # cyan
COLOR_BG_DARK = colors.HexColor('#0a0e14')      # near-black
COLOR_ACCENT = colors.HexColor('#a855f7')       # purple
COLOR_OK = colors.HexColor('#3ddba5')           # green
COLOR_WARN = colors.HexColor('#ffa31a')         # amber
COLOR_DANGER = colors.HexColor('#ff5b50')       # red
COLOR_MUTED = colors.HexColor('#7e8a9e')        # gray
COLOR_BG_LIGHT = colors.HexColor('#f5f7fa')
COLOR_BG_CARD = colors.HexColor('#eef2f7')

# ── 스타일 ──
styles = getSampleStyleSheet()

STYLE_TITLE = ParagraphStyle(
    name='AIOTitle', parent=styles['Title'],
    fontName='MalgunBd', fontSize=24, leading=30,
    textColor=COLOR_BG_DARK, alignment=TA_CENTER, spaceAfter=8,
)
STYLE_SUBTITLE = ParagraphStyle(
    name='AIOSubtitle', parent=styles['Normal'],
    fontName='Malgun', fontSize=12, leading=16,
    textColor=COLOR_MUTED, alignment=TA_CENTER, spaceAfter=24,
)
STYLE_H1 = ParagraphStyle(
    name='AIOH1', parent=styles['Heading1'],
    fontName='MalgunBd', fontSize=18, leading=24,
    textColor=COLOR_PRIMARY, spaceBefore=20, spaceAfter=10,
    borderPadding=(4, 0, 4, 0),
)
STYLE_H2 = ParagraphStyle(
    name='AIOH2', parent=styles['Heading2'],
    fontName='MalgunBd', fontSize=14, leading=20,
    textColor=COLOR_BG_DARK, spaceBefore=14, spaceAfter=6,
)
STYLE_BODY = ParagraphStyle(
    name='AIOBody', parent=styles['Normal'],
    fontName='Malgun', fontSize=10, leading=15,
    textColor=COLOR_BG_DARK, alignment=TA_LEFT, spaceAfter=4,
)
STYLE_BULLET = ParagraphStyle(
    name='AIOBullet', parent=STYLE_BODY,
    leftIndent=14, bulletIndent=2, spaceAfter=2,
)
STYLE_CODE = ParagraphStyle(
    name='AIOCode', parent=STYLE_BODY,
    fontName='Courier', fontSize=9, leading=12,
    backColor=colors.HexColor('#1a1f2a'), textColor=colors.HexColor('#7afff0'),
    borderPadding=(6, 6, 6, 6), spaceAfter=6,
)
STYLE_TIP = ParagraphStyle(
    name='AIOTip', parent=STYLE_BODY,
    backColor=colors.HexColor('#fff8e1'), borderPadding=(8, 8, 8, 8),
    borderColor=COLOR_WARN, borderWidth=0.5,
    spaceBefore=4, spaceAfter=8,
)
STYLE_OK = ParagraphStyle(
    name='AIOOk', parent=STYLE_BODY,
    backColor=colors.HexColor('#e6faf3'), borderPadding=(8, 8, 8, 8),
    borderColor=COLOR_OK, borderWidth=0.5,
    spaceBefore=4, spaceAfter=8,
)
STYLE_WARN = ParagraphStyle(
    name='AIOWarn', parent=STYLE_BODY,
    backColor=colors.HexColor('#fee9e6'), borderPadding=(8, 8, 8, 8),
    borderColor=COLOR_DANGER, borderWidth=0.5,
    spaceBefore=4, spaceAfter=8,
)
STYLE_SMALL = ParagraphStyle(
    name='AIOSmall', parent=STYLE_BODY,
    fontSize=8, leading=11, textColor=COLOR_MUTED,
)


# ── 헬퍼 ──
def b(text):
    return f'<b>{text}</b>'


def c(text, color):
    return f'<font color="{color}">{text}</font>'


def link(text, url):
    return f'<link href="{url}" color="#00a8d4">{text}</link>'


def hr():
    t = Table([['']], colWidths=[170 * mm], rowHeights=[0.4 * mm])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), COLOR_MUTED)]))
    return t


def card_table(rows, col_widths, header_bg=COLOR_PRIMARY, header_color=colors.white):
    """헤더가 있는 카드형 표"""
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), header_bg),
        ('TEXTCOLOR', (0, 0), (-1, 0), header_color),
        ('FONTNAME', (0, 0), (-1, 0), 'MalgunBd'),
        ('FONTNAME', (0, 1), (-1, -1), 'Malgun'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.25, COLOR_MUTED),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, COLOR_BG_LIGHT]),
    ]))
    return t


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont('Malgun', 8)
    canvas.setFillColor(COLOR_MUTED)
    canvas.drawString(20 * mm, 12 * mm, f'AIO Screener · API Setup Guide {GUIDE_VERSION}')
    canvas.drawRightString(190 * mm, 12 * mm, f'Page {doc.page}')
    canvas.setStrokeColor(COLOR_MUTED)
    canvas.setLineWidth(0.3)
    canvas.line(20 * mm, 14 * mm, 190 * mm, 14 * mm)
    canvas.restoreState()


story = []

# ─────────────────── 표지 ───────────────────
story.append(Spacer(1, 26 * mm))
story.append(Paragraph('AIO Screener', STYLE_TITLE))
story.append(Paragraph('API 가이드 &amp; 초기 설정 방법', STYLE_TITLE))
story.append(Spacer(1, 6 * mm))
story.append(Paragraph(f'{GUIDE_VERSION} · 2026년 9월 기준', STYLE_SUBTITLE))
story.append(Spacer(1, 16 * mm))

intro_box = [
    [Paragraph(b('🚀 AIO Screener란?'),
               ParagraphStyle('IntroH', fontName='MalgunBd', fontSize=13, textColor=COLOR_PRIMARY, leading=18))],
    [Paragraph(
        '실시간 시장 분석, 매매 시그널, 섹터 로테이션(RRG), 포트폴리오 관리, '
        'AI 채팅을 하나의 웹사이트에 담은 <b>올인원 투자 터미널</b>.', STYLE_BODY)],
    [Paragraph(
        b('가장 중요한 사실: ') + 'Claude AI 와 시장 데이터 일부는 <b>이미 공유 설정으로 동작</b>합니다. '
        '아무 키도 입력하지 않아도 화면은 채워집니다. 아래 키들은 <b>선택 사항</b>이며, '
        '입력하면 그 소스의 최신성과 범위가 좋아집니다.', STYLE_BODY)],
    [Spacer(1, 4 * mm)],
    [Paragraph(b('🌐 사이트: ') + link(SITE_URL, SITE_URL), STYLE_BODY)],
    [Paragraph(b('💰 비용: ') + '운영자가 부담하는 공유 키(Claude·FRED 등) 외에는 모두 ' +
               '<font color="#3ddba5"><b>무료</b></font> (신용카드 불필요)', STYLE_BODY)],
]
intro_table = Table(intro_box, colWidths=[170 * mm])
intro_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_CARD),
    ('LEFTPADDING', (0, 0), (-1, -1), 12),
    ('RIGHTPADDING', (0, 0), (-1, -1), 12),
    ('TOPPADDING', (0, 0), (-1, -1), 8),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ('BOX', (0, 0), (-1, -1), 1, COLOR_PRIMARY),
]))
story.append(intro_table)
story.append(Spacer(1, 10 * mm))

story.append(Paragraph(
    b('⚠ 투자 면책: ') + '본 터미널이 제공하는 모든 정보는 참고용이며, 투자 결정은 본인의 판단과 책임하에 '
    '이루어져야 합니다. 실시간 데이터의 정확성이나 완전성을 보장하지 않습니다.', STYLE_WARN))

story.append(PageBreak())

# ─────────────────── 목차 ───────────────────
story.append(Paragraph('목차', STYLE_H1))
toc_rows = [
    ['#', '챕터', '성격'],
    ['1', '가장 먼저 알아야 할 것 — 무엇이 공유이고 무엇이 개인인가', '필독'],
    ['2', '키 입력 위치와 저장 방식', '필독'],
    ['3', 'Claude AI (공유) — AI 채팅·분석 엔진', '공유'],
    ['4', 'FRED · BOK ECOS · KOSIS (공유 릴레이) — 매크로 지표', '공유'],
    ['5', '사용자별 선택 키 — 시세·차트·재무·뉴스', '선택'],
    ['6', '외부 웹 검색 (Perplexity · Google CSE)', '선택'],
    ['7', '자체 Cloudflare Worker (고급)', '선택'],
    ['8', '검증 · 백업 · 트러블슈팅', '필독'],
]
story.append(card_table(toc_rows, [12 * mm, 128 * mm, 30 * mm]))
story.append(Spacer(1, 6 * mm))
story.append(Paragraph(
    b('🎯 최소 설정:') + ' 아무것도 입력하지 않아도 동작합니다. '
    '차트·기술지표를 더 원하면 Twelve Data 키 하나만 추가하는 것을 권장합니다.', STYLE_OK))

story.append(PageBreak())

# ─────────────────── Chapter 1 ───────────────────
story.append(Paragraph('1. 무엇이 공유이고 무엇이 개인인가', STYLE_H1))
story.append(Paragraph(
    '이 터미널의 자격증명은 두 종류입니다. 이 구분을 모르면 '
    '"키를 넣었는데 왜 안 되지"가 생깁니다.', STYLE_BODY))

story.append(Paragraph('1.1 공유 (운영자 소유) — 사용자는 아무것도 입력하지 않는다', STYLE_H2))
shared_rows = [
    ['소스', '동작 방식', '사용자 입력'],
    ['Claude AI', '공유 Worker(aio-proxy)의 POST /anthropic 이 운영자 키로 대신 호출', '불필요'],
    ['FRED (매크로)', '공유 Worker의 GET /relay?provider=fred 가 운영자 키로 조회', '불필요'],
    ['BOK ECOS (한국은행)', '같은 /relay 경로 (provider=bok)', '불필요'],
    ['KOSIS (통계청)', '같은 /relay 경로 (provider=kosis)', '불필요'],
    ['시세 스냅샷', 'GitHub Actions 가 주기적으로 public-data/*.json 생성', '불필요'],
]
story.append(card_table(shared_rows, [38 * mm, 100 * mm, 32 * mm]))
story.append(Paragraph(
    b('왜 릴레이인가: ') + 'FRED 는 브라우저 직접 호출을 CORS 로 막고, BOK ECOS·KOSIS 는 애초에 '
    'CORS 헤더를 보내지 않습니다. 그래서 이 세 소스는 서버(Worker)를 거쳐야만 실시간으로 동작합니다. '
    '운영자 키는 Worker 시크릿에만 있고 브라우저로 전송되지 않습니다.', STYLE_TIP))

story.append(Paragraph('1.2 개인 (사용자별) — 사이드바에서 직접 발급·입력', STYLE_H2))
story.append(Paragraph(
    '아래 항목들은 <b>각 사용자가 자기 키를 발급</b>해 입력합니다. 키는 그 브라우저의 '
    'localStorage 에만 저장되며(선택 시 암호화), 서버로 전송되지 않습니다. '
    '"AIO Screener" 키가 아니라 본인 계정의 키입니다.', STYLE_BODY))
story.append(Paragraph(
    'Alpha Vantage · Finnhub · FMP · Twelve Data · NewsData.io · RSS2JSON · '
    'Perplexity · Google CSE(키+cx) · BOK ECOS · KOSIS · FRED · CF Worker URL', STYLE_BULLET))
story.append(Paragraph(
    b('※ ') + 'FRED·BOK·KOSIS 는 공유 릴레이로 이미 동작합니다. 개인 키를 넣으면 '
    '본인 한도로 먼저 시도하고, 실패하면 릴레이로 넘어갑니다. 넣지 않아도 무방합니다.', STYLE_SMALL))

story.append(PageBreak())

# ─────────────────── Chapter 2 ───────────────────
story.append(Paragraph('2. 키 입력 위치와 저장 방식', STYLE_H1))
story.append(Paragraph(
    '<b>좌측 사이드바 → "연결·키 보안 설정" → "확장 API 키 설정"</b> 을 펼치면 입력란이 나옵니다. '
    'Claude 키는 그 위쪽 "AI 도우미" 영역에 따로 있습니다.', STYLE_BODY))

story.append(Paragraph('2.1 저장 방식', STYLE_H2))
storage_rows = [
    ['모드', '저장 위치', '지속성'],
    ['기본', '브라우저 localStorage(평문)', '새로고침·브라우저 재시작·재부팅까지 유지'],
    ['Vault PIN 설정', 'localStorage 에 AES-GCM 암호화(aio_enc::…)', '유지되지만 세션마다 PIN 재입력 필요'],
    ['공용 PC 모드', 'sessionStorage', '탭을 닫으면 삭제(의도적)'],
]
story.append(card_table(storage_rows, [30 * mm, 65 * mm, 75 * mm]))
story.append(Paragraph(
    b('💾 중요: ') + '서버에 키를 보관하지 않으므로 <b>기기 간 동기화가 없습니다.</b> '
    '다른 PC·폰에서 쓰려면 그 기기에서 다시 입력해야 합니다. '
    '또한 브라우저 캐시를 지우면 키가 함께 사라지므로, 필요하면 사이드바의 '
    '<b>백업</b> 버튼으로 JSON 파일을 받아 두세요(복원도 같은 영역).', STYLE_TIP))

story.append(Paragraph('2.2 저장되지 않는 상태 구분', STYLE_H2))
story.append(Paragraph(
    '사이드바의 공급자 상태 요약은 <b>"저장 N개 · 실제 호출 성공 M개"</b> 를 따로 보여줍니다. '
    '저장은 연결의 증거가 아닙니다 — 키를 넣어도 그 소스가 브라우저에서 막히거나 한도를 넘으면 '
    '성공 개수는 늘지 않습니다.', STYLE_BODY))

story.append(PageBreak())

# ─────────────────── Chapter 3 ───────────────────
story.append(Paragraph('3. Claude AI (공유)', STYLE_H1))
story.append(Paragraph(
    b('역할: ') + 'AI 채팅 + 종목 분석 + 매매 시그널 해석 엔진. '
    '가장 먼저 시도되는 경로는 <b>공유 Worker</b>이므로 개인 키 없이도 동작합니다.', STYLE_BODY))

story.append(Paragraph('3.1 공유 경로 (기본)', STYLE_H2))
story.append(Paragraph(
    '아무 설정이 없으면 사이드바의 공유 Worker 주소로 요청이 나가고, Worker 가 자기 시크릿 키로 '
    'Anthropic 을 호출합니다. 사용자 개인 키는 쓰이지 않습니다. '
    '운영자 설정에 따라 일일 호출 상한이 걸려 있을 수 있습니다.', STYLE_BODY))

story.append(Paragraph('3.2 개인 키를 쓰고 싶다면', STYLE_H2))
story.append(Paragraph(
    '① ' + link('console.anthropic.com', 'https://console.anthropic.com') +
    ' 가입 → 좌측 "API Keys" → "Create Key" → <font face="Courier">sk-ant-…</font> 복사.', STYLE_BULLET))
story.append(Paragraph(
    '② 사이드바 "AI 도우미" 영역의 입력란에 붙여넣고 <b>저장</b>. 개인 키가 있으면 개인 키가 우선합니다.', STYLE_BULLET))
story.append(Paragraph(
    b('⚠ 주의: ') + '"확장 API 키 설정" 안의 <b>"개인 Worker 서버 키 모드"</b> 체크박스를 켜면, '
    '개인 Claude 키가 있어도 <b>Worker 키가 우선</b>하게 됩니다. 개인 Worker URL 을 넣지 않은 상태에서 '
    '켜면 아무 효과도 없으며, 그 경우 화면에 경고가 표시됩니다.', STYLE_WARN))

story.append(Paragraph('3.3 비용 (개인 키를 쓸 때만)', STYLE_H2))
cost_rows = [
    ['모델', '입력 (1M 토큰)', '출력 (1M 토큰)', '용도'],
    ['Claude Sonnet 계열', '$3', '$15', '기본 (자동 선택)'],
    ['Claude Haiku 계열', '$0.80', '$4', '간단한 질문 (자동)'],
]
story.append(card_table(cost_rows, [45 * mm, 30 * mm, 30 * mm, 65 * mm]))
story.append(Paragraph(
    b('💡 한도 설정 권장: ') + 'Anthropic 콘솔 → Settings → Limits 에서 월 한도를 걸어 두면 안전합니다.', STYLE_TIP))

story.append(PageBreak())

# ─────────────────── Chapter 4 ───────────────────
story.append(Paragraph('4. FRED · BOK ECOS · KOSIS (공유 릴레이)', STYLE_H1))
story.append(Paragraph(
    b('역할: ') + 'FRED 는 CPI·실업률·Fed Funds·10Y 금리·GDP·PCE 같은 미국 매크로 시계열, '
    'BOK ECOS 는 한국은행 기준금리·환율·수출입, KOSIS 는 통계청 CPI·실업률을 제공합니다.', STYLE_BODY))

story.append(Paragraph('4.1 사용자가 할 일: 없음', STYLE_H2))
story.append(Paragraph(
    '이 세 소스는 공유 Worker 의 <b>/relay</b> 가 운영자 키로 대신 조회합니다. '
    '사이드바에 키를 넣지 않아도 매크로 페이지가 채워집니다.', STYLE_OK))
story.append(Paragraph(
    b('개인 키를 넣는다면: ') + '본인 FRED 키가 개인 Cloudflare Worker 와 함께 설정된 경우에만 '
    '직접 경로가 먼저 시도됩니다. 그 외에는 릴레이가 사용됩니다. '
    'BOK·KOSIS 개인 키는 브라우저에서 직접 호출이 불가능하므로 공유 릴레이가 사실상 유일한 실시간 경로입니다.', STYLE_TIP))

story.append(Paragraph('4.2 운영자(공유 설정을 관리하는 사람)만 하는 일', STYLE_H2))
story.append(Paragraph(
    '저장소 시크릿에 FRED_API_KEY(필수), BOK_API_KEY·KOSIS_API_KEY(선택)를 등록하고 '
    '"Deploy AI proxy" 워크플로를 수동 실행하면 배포 시 Worker 시크릿으로 게시됩니다. '
    '키가 없는 제공자는 그 제공자만 조용히 503 으로 비활성화되고, 나머지는 정상 동작합니다.', STYLE_BODY))

story.append(PageBreak())

# ─────────────────── Chapter 5 ───────────────────
story.append(Paragraph('5. 사용자별 선택 키', STYLE_H1))
story.append(Paragraph(
    '아래 키들은 <b>전부 선택</b>입니다. 없으면 그 기능만 비거나 무료 대체 경로로 표시됩니다.', STYLE_BODY))

opt_rows = [
    ['키', '발급처', '있으면 좋아지는 것'],
    ['Twelve Data', 'twelvedata.com', '기술지표(RSI/MACD/볼린저)·차트 OHLCV. 무료 800회/일'],
    ['Finnhub', 'finnhub.io', '실시간 시세 보조·애널리스트 컨센서스·어닝 캘린더·종목 뉴스'],
    ['FMP', 'financialmodelingprep.com', '재무제표·밸류에이션(PER/PBR/EV). 무료 250회/일'],
    ['Alpha Vantage', 'alphavantage.co', '시장 폭(상승/하락 종목 수). 무료 25회/일'],
    ['NewsData.io', 'newsdata.io', '영문 비즈니스 뉴스 헤드라인'],
    ['RSS2JSON', 'rss2json.com', 'RSS 뉴스 갱신 한도 상향(1000 → 10000)'],
]
story.append(card_table(opt_rows, [30 * mm, 50 * mm, 90 * mm]))
story.append(Paragraph(
    b('🎯 권장 순서: ') + 'Twelve Data → Finnhub → FMP. 나머지는 여유가 될 때 추가하세요.', STYLE_OK))

story.append(PageBreak())

# ─────────────────── Chapter 6 ───────────────────
story.append(Paragraph('6. 외부 웹 검색 (Perplexity · Google CSE)', STYLE_H1))
story.append(Paragraph(
    b('기본 동작: ') + 'Claude 의 내장 웹 검색이 기본입니다. 별도 키 없이도 '
    '"오늘 NVDA 뉴스" 같은 질문에 검색 결과가 붙습니다(사이드바 "Claude 웹 검색" 토글로 끌 수 있음).', STYLE_BODY))
story.append(Paragraph(
    b('외부 제공자를 쓰고 싶다면 ') + '사이드바 "확장 API 키 설정" 에 v56 부터 입력란이 있습니다.', STYLE_BODY))

search_rows = [
    ['키', '발급처', '비고'],
    ['Perplexity', 'perplexity.ai/settings/api', 'Pro 구독 필요($20/월). AI 요약 + 출처'],
    ['Google CSE 키', 'console.cloud.google.com', 'Custom Search JSON API 키(무료 100회/일)'],
    ['Google CSE cx', 'programmablesearchengine.google.com', '검색엔진 ID. 키와 <b>함께</b> 있어야 동작'],
]
story.append(card_table(search_rows, [32 * mm, 58 * mm, 80 * mm]))
story.append(Paragraph(
    b('⚠ 주의: ') + 'Google CSE 는 키와 cx 가 모두 있어야 검색이 됩니다. 하나만 넣으면 '
    'Claude 내장 검색으로 넘어갑니다.', STYLE_WARN))

story.append(PageBreak())

# ─────────────────── Chapter 7 ───────────────────
story.append(Paragraph('7. 자체 Cloudflare Worker (고급 · 선택)', STYLE_H1))
story.append(Paragraph(
    '기본 상태에서는 공용 Worker 를 씁니다. 직접 만든 Worker 를 쓰면 가용성이 좋아지고, '
    '<b>개인 키가 URL 에 실리는 요청</b>(예: 본인 FRED 키 직접 조회)을 안전하게 중계할 수 있습니다.', STYLE_BODY))
story.append(Paragraph(
    b('중요한 경계: ') + '공용 Worker 는 <b>개인 키를 받지 않습니다.</b> 그래서 개인 Worker URL 을 '
    '설정하지 않으면 개인 키 기반 요청은 "사용 가능한 중계 경로 없음"으로 표시되고 서버 스냅샷으로 넘어갑니다. '
    '이것은 버그가 아니라 개인 키 유출을 막는 의도된 설계입니다.', STYLE_TIP))
story.append(Paragraph(
    '사이드바 "확장 API 키 설정" 의 <b>CF Worker URL</b> 입력란에 본인 Worker 주소를 넣으면 즉시 적용됩니다.', STYLE_BODY))

story.append(PageBreak())

# ─────────────────── Chapter 8 ───────────────────
story.append(Paragraph('8. 검증 · 백업 · 트러블슈팅', STYLE_H1))

story.append(Paragraph('8.1 동작 확인 순서', STYLE_H2))
story.append(Paragraph(
    '1. 좌측 메뉴 → <b>시장</b> 페이지에서 지수·환율·금리가 채워지는지 확인 (공유 Worker/스냅샷 경로)', STYLE_BULLET))
story.append(Paragraph(
    '2. <b>기업 분석</b> → "NVDA" 검색 → 가격·재무·뉴스가 나오는지 확인', STYLE_BULLET))
story.append(Paragraph(
    '3. <b>매크로</b> 페이지에서 CPI·실업률·금리 시계열 확인 (공유 /relay 경로)', STYLE_BULLET))
story.append(Paragraph(
    '4. AI 채팅에 "오늘 엔비디아 뉴스" 입력 → 검색 배지가 뜨고 출처가 붙는지 확인', STYLE_BULLET))

story.append(Paragraph('8.2 키 백업/복원', STYLE_H2))
story.append(Paragraph(
    '사이드바 "시스템 자가 진단" 영역의 <b>백업</b> / <b>복원</b> 버튼을 사용합니다. '
    '백업은 JSON 파일로 내려받고, 복원은 그 파일을 선택합니다. '
    '브라우저 캐시를 지우면 localStorage 의 키가 사라지므로 주기적 백업을 권장합니다.', STYLE_BODY))
story.append(Paragraph(
    b('※ ') + '과거 버전에 있던 IndexedDB 자동 백업은 개인정보 보호를 위해 폐기되었습니다. '
    '현재 보존 경로는 (1) localStorage, (2) JSON 백업 파일 두 가지입니다.', STYLE_SMALL))

story.append(Paragraph('8.3 자주 묻는 문제', STYLE_H2))
faq_rows = [
    ['증상', '원인', '해결'],
    ['AI 채팅이 답을 못 함', '공유 Worker 불가 + 개인 키 없음', '개인 Claude 키를 입력하거나 잠시 후 재시도'],
    ['매크로 값이 안 바뀜', '공유 /relay 의 운영자 키 미등록', '운영자가 FRED_API_KEY 등을 등록해야 함'],
    ['키를 넣었는데 상태가 "미확인"', '아직 실제 호출이 없었음', '해당 페이지를 열어 1회 호출시킨 뒤 새로고침'],
    ['데이터가 모두 "—"', '서비스 워커 캐시가 오래됨', 'Ctrl+Shift+R 강력 새로고침'],
    ['차트·지표가 비어 있음', 'Twelve Data 키 없음/한도 초과', '키 등록 또는 다음 날 재시도'],
    ['개인 키 기반 요청이 계속 실패', '공용 Worker 는 개인 키를 중계하지 않음', '본인 Worker URL 을 등록'],
]
story.append(card_table(faq_rows, [45 * mm, 55 * mm, 70 * mm]))

story.append(PageBreak())

# ─────────────────── 마지막 페이지 ───────────────────
story.append(Paragraph('🚀 빠른 시작 (5분)', STYLE_H1))
story.append(Spacer(1, 4 * mm))

quick = [
    ('1', '0분', '사이트 접속 — 이 시점에 이미 시세·매크로·AI 채팅이 공유 설정으로 동작합니다', '#a855f7'),
    ('2', '3분', 'twelvedata.com 가입 → API 키 복사 → 사이드바 "확장 API 키 설정" → Twelve Data 입력 → 저장', '#00d4ff'),
    ('3', '2분', 'finnhub.io/register 가입 → Dashboard 키 복사 → Finnhub 입력 → 저장', '#3ddba5'),
    ('4', '1분', '사이드바 "백업" 버튼으로 키 JSON 을 받아 둡니다', '#ffa31a'),
]
for num, time, action, color in quick:
    row = [
        Paragraph(f'<font color="{color}" size="20"><b>{num}</b></font>',
                  ParagraphStyle('QNum', fontName='MalgunBd', alignment=TA_CENTER)),
        Paragraph(f'<b>{time}</b><br/>{action}', STYLE_BODY),
    ]
    t = Table([row], colWidths=[15 * mm, 155 * mm])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.3, COLOR_MUTED),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LINEBEFORE', (0, 0), (0, -1), 4, colors.HexColor(color)),
    ]))
    story.append(t)
    story.append(Spacer(1, 3 * mm))

story.append(Spacer(1, 8 * mm))
story.append(Paragraph(b('🎯 완료 후 권장 첫 액션'), STYLE_H2))
story.append(Paragraph(
    '<b>1.</b> 사이드바 → "포트폴리오" → 보유 종목 입력(분석에 자동 반영)<br/>'
    '<b>2.</b> 사이드바 → "워치리스트" → 관심 종목 등록(실시간 가격 자동 갱신)<br/>'
    '<b>3.</b> 매일 아침 <b>브리핑</b> 페이지로 시작 — 시장 환경과 확인할 항목을 정리해 줍니다', STYLE_BODY))

story.append(Spacer(1, 12 * mm))
story.append(hr())
story.append(Spacer(1, 4 * mm))
story.append(Paragraph(
    '사이트: ' + link(SITE_URL, SITE_URL) +
    '<br/>이 PDF 는 <font face="Courier">aio_api_setup_guide.py</font> 로 생성됩니다 — '
    '코드가 바뀌면 이 스크립트를 다시 실행해 갱신하세요.' +
    f'<br/>AIO Screener {GUIDE_VERSION} · 2026년 9월',
    STYLE_SMALL))

# ── 빌드 ──
doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=20 * mm, rightMargin=20 * mm,
    topMargin=18 * mm, bottomMargin=20 * mm,
    title=f'AIO Screener API Setup Guide {GUIDE_VERSION}',
    author='AIO Screener',
    subject='API 가이드 + 초기 설정 방법',
)

doc.build(story, onFirstPage=on_page, onLaterPages=on_page)

import sys
sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None
try:
    print(f'[OK] PDF generated: {OUTPUT}')
    print(f'     size: {os.path.getsize(OUTPUT) / 1024:.1f} KB')
except Exception:
    pass

try:
    from pypdf import PdfReader
    r = PdfReader(OUTPUT)
    print(f'     pages: {len(r.pages)}')
except Exception:
    pass
