"""
AIO Screener API 가이드 + 초기 설정 방법 PDF 생성
- 한글 폰트: Malgun Gothic (Windows 기본)
- 5개 API 키 발급 가이드 + 사이트 등록 순서 + 비용/한도 비교
"""
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── 한글 폰트 등록 ──
pdfmetrics.registerFont(TTFont('Malgun', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('MalgunBd', 'C:/Windows/Fonts/malgunbd.ttf'))
from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily('Malgun', normal='Malgun', bold='MalgunBd', italic='Malgun', boldItalic='MalgunBd')

OUTPUT = "C:/Users/zmfhd/OneDrive/문서/Claude/Projects/AIO/AIO_Screener_API_Setup_Guide.pdf"

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
STYLE_H3 = ParagraphStyle(
    name='AIOH3', parent=styles['Heading3'],
    fontName='MalgunBd', fontSize=11, leading=16,
    textColor=COLOR_ACCENT, spaceBefore=8, spaceAfter=4,
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
def b(text):  # 굵게
    return f'<b>{text}</b>'

def c(text, color):  # 색상
    return f'<font color="{color}">{text}</font>'

def link(text, url):
    return f'<link href="{url}" color="#00a8d4">{text}</link>'

def hr():
    t = Table([['']], colWidths=[170*mm], rowHeights=[0.4*mm])
    t.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), COLOR_MUTED)]))
    return t

def card_table(rows, col_widths, header_bg=COLOR_PRIMARY, header_color=colors.white):
    """헤더가 있는 카드형 표"""
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), header_bg),
        ('TEXTCOLOR', (0,0), (-1,0), header_color),
        ('FONTNAME', (0,0), (-1,0), 'MalgunBd'),
        ('FONTNAME', (0,1), (-1,-1), 'Malgun'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('GRID', (0,0), (-1,-1), 0.25, COLOR_MUTED),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, COLOR_BG_LIGHT]),
    ]))
    return t

# ── 페이지 콜백 (footer) ──
def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont('Malgun', 8)
    canvas.setFillColor(COLOR_MUTED)
    canvas.drawString(20*mm, 12*mm, 'AIO Screener · API Setup Guide v49.57')
    canvas.drawRightString(190*mm, 12*mm, f'Page {doc.page}')
    canvas.setStrokeColor(COLOR_MUTED)
    canvas.setLineWidth(0.3)
    canvas.line(20*mm, 14*mm, 190*mm, 14*mm)
    canvas.restoreState()

# ── 컨텐츠 ──
story = []

# ─────────────────── 표지 ───────────────────
story.append(Spacer(1, 30*mm))
story.append(Paragraph('AIO Screener', STYLE_TITLE))
story.append(Paragraph('API 가이드 &amp; 초기 설정 방법', STYLE_TITLE))
story.append(Spacer(1, 6*mm))
story.append(Paragraph('v49.57 · 2026년 5월 기준', STYLE_SUBTITLE))
story.append(Spacer(1, 20*mm))

# 표지 박스 — 사이트 소개
intro_box = [
    [Paragraph(b('🚀 AIO Screener란?'), ParagraphStyle('IntroH', fontName='MalgunBd', fontSize=13, textColor=COLOR_PRIMARY, leading=18))],
    [Paragraph(
        '실시간 시장 분석, 매매 시그널, 섹터 로테이션(RRG), 포트폴리오 관리, '
        'AI 채팅을 하나의 웹사이트에 담은 <b>올인원 투자 터미널</b>. '
        '<b>5개 무료 API</b>를 조합하여 정량 80% + 정성 70% 데이터 커버 가능.', STYLE_BODY)],
    [Spacer(1, 4*mm)],
    [Paragraph(b('🌐 사이트: ') + link('https://ysnle.github.io/aio-screener/', 'https://ysnle.github.io/aio-screener/'), STYLE_BODY)],
    [Paragraph(b('💰 비용: ') + 'Claude API 외 모두 <font color="#3ddba5"><b>무료</b></font> (신용카드 불필요)', STYLE_BODY)],
    [Paragraph(b('⏱ 설정 시간: ') + '약 15~20분 (5개 키 발급)', STYLE_BODY)],
]
intro_table = Table(intro_box, colWidths=[170*mm])
intro_table.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), COLOR_BG_CARD),
    ('LEFTPADDING', (0,0), (-1,-1), 12),
    ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ('TOPPADDING', (0,0), (-1,-1), 8),
    ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ('BOX', (0,0), (-1,-1), 1, COLOR_PRIMARY),
]))
story.append(intro_table)
story.append(Spacer(1, 12*mm))

# 표지 워닝
story.append(Paragraph(
    b('⚠ 투자 면책: ') + '본 터미널이 제공하는 모든 정보는 참고용이며, 투자 결정은 본인의 판단과 책임하에 이루어져야 합니다. '
    '실시간 데이터의 정확성이나 완전성을 보장하지 않습니다.', STYLE_WARN))

story.append(PageBreak())

# ─────────────────── 목차 ───────────────────
story.append(Paragraph('목차', STYLE_H1))
toc_rows = [
    ['#', '챕터', '소요시간'],
    ['0', '시작하기 전에 — 사이트 열기 + API 키 입력 위치', '2분'],
    ['1', 'Claude API (필수) — AI 채팅·분석 엔진', '3분'],
    ['2', 'Finnhub API (강력 권장) — 실시간 시세·어닝·뉴스', '3분'],
    ['3', 'FMP API (권장) — 기업 재무·밸류에이션', '3분'],
    ['4', 'FRED API (선택) — 매크로 경제 지표', '2분'],
    ['5', 'Perplexity API (선택) — 실시간 웹 검색', '3분'],
    ['6', '키 등록 후 검증 — 사이트 내 self-check', '2분'],
    ['7', '비용 관리 + 백업 + 트러블슈팅', '필독'],
    ['8', '부록 — v49.57 신규 기능 + 무료 API 매트릭스', '참고'],
]
story.append(card_table(toc_rows, [12*mm, 130*mm, 28*mm]))
story.append(Spacer(1, 6*mm))
story.append(Paragraph(b('🎯 전체 소요시간:') + ' 약 15~20분 (Claude + Finnhub + FMP 3개만 등록하면 기본 운용 가능)', STYLE_OK))

story.append(PageBreak())

# ─────────────────── Chapter 0: 시작하기 전에 ───────────────────
story.append(Paragraph('0. 시작하기 전에', STYLE_H1))
story.append(Paragraph(b('사이트 접속 + API 키 입력 위치 먼저 확인하세요.'), STYLE_BODY))
story.append(Spacer(1, 4*mm))

story.append(Paragraph('0.1 사이트 접속', STYLE_H2))
story.append(Paragraph(
    '브라우저에서 ' + link('https://ysnle.github.io/aio-screener/', 'https://ysnle.github.io/aio-screener/') +
    '에 접속합니다. <b>크롬/엣지/파이어폭스</b> 모두 지원. 모바일도 동작하나 데스크톱 권장.', STYLE_BODY))
story.append(Paragraph(
    '<b>첫 방문 시:</b> "AIO Screener에 오신 것을 환영합니다" 온보딩 모달이 표시됩니다. '
    '이 가이드를 따라 API 키를 등록한 후 모달을 닫으세요.', STYLE_BODY))

story.append(Paragraph('0.2 API 키 입력 위치 (사이드바)', STYLE_H2))
story.append(Paragraph(
    '<b>좌측 상단의 ☰ 메뉴 버튼 →  사이드바 → "API 키 설정" 섹션</b>에 5개 키 입력란이 있습니다. '
    '각 입력란에 발급받은 키를 붙여넣고 <b>저장</b> 버튼을 누르면 됩니다.', STYLE_BODY))

story.append(Paragraph(b('💾 저장 위치:') + ' localStorage (브라우저 로컬). 서버 전송 X. 다른 기기에서는 다시 입력 필요.', STYLE_TIP))

story.append(Paragraph('0.3 키 백업 (캐시 클리어 대비)', STYLE_H2))
story.append(Paragraph(
    'v49.45부터 <b>IndexedDB 자동 미러링</b> + 수동 백업 명령 지원. 캐시 클리어 시 키 손실 방지.', STYLE_BODY))
story.append(Paragraph('// 키 입력 후 콘솔에서 실행:', STYLE_SMALL))
story.append(Paragraph('AIO.exportApiKeys({masked: false})  <font color="#7e8a9e">// JSON 파일 다운로드</font><br/>'
                       'AIO.recoverApiKeysFromIdb()         <font color="#7e8a9e">// 캐시 클리어 후 자동 복원</font>', STYLE_CODE))

story.append(PageBreak())

# ─────────────────── Chapter 1: Claude API ───────────────────
story.append(Paragraph('1. Claude API (필수)', STYLE_H1))
story.append(Paragraph(b('역할:') + ' AI 채팅 + 종목 분석 + 매매 시그널 해석 엔진. ' + b('이게 없으면 채팅 기능 작동 X.'), STYLE_BODY))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('1.1 키 발급 (Anthropic 콘솔)', STYLE_H2))
steps_claude = [
    '<b>① 웹사이트 접속:</b> ' + link('https://console.anthropic.com', 'https://console.anthropic.com'),
    '<b>② 회원가입:</b> Google/이메일로 가입 (한국 IP 가능, 신용카드 불필요 - 가입 시 $5 무료 크레딧 자동 충전)',
    '<b>③ 좌측 메뉴 → "API Keys"</b> 클릭',
    '<b>④ "Create Key" 버튼</b> → 이름 입력 (예: "AIO Screener") → "Create"',
    '<b>⑤ 키 복사:</b> <font color="#ff5b50"><b>이 화면을 닫으면 키를 다시 못 봅니다.</b></font> 반드시 즉시 복사 + 안전한 곳에 백업',
    '<b>⑥ 형식:</b> <font face="Courier">sk-ant-api03-...</font> (sk-ant로 시작하는 100+자리 문자열)',
]
for s in steps_claude:
    story.append(Paragraph('• ' + s, STYLE_BULLET))

story.append(Paragraph('1.2 AIO 사이트 등록', STYLE_H2))
story.append(Paragraph('사이드바 → "API 키 설정" → <b>Claude API 키</b> 입력란에 붙여넣기 → 저장', STYLE_BODY))

story.append(Paragraph('1.3 비용 (반드시 읽기)', STYLE_H2))
cost_claude = [
    ['모델', '입력 (1M토큰)', '출력 (1M토큰)', '용도'],
    ['Claude Sonnet 4.5/4.6', '$3', '$15', '기본 (자동 선택)'],
    ['Claude Opus 4.x', '$15', '$75', '심층 분석 자동 전환'],
    ['Claude Haiku', '$0.80', '$4', '간단한 질문 (자동)'],
]
story.append(card_table(cost_claude, [40*mm, 30*mm, 30*mm, 70*mm]))
story.append(Paragraph(
    b('💡 실제 사용량:') + ' 하루 50~100회 채팅 ≈ <b>월 $3~10</b>. '
    'AIO는 v48.0부터 <b>prompt caching</b> 적용해 input 토큰 90% 절감 (재사용 시).', STYLE_OK))
story.append(Paragraph(
    b('⚠ 한도 설정 권장:') + ' Anthropic 콘솔 → Settings → Limits에서 <b>월 한도 $20~50</b> 설정 (안전장치).', STYLE_WARN))

story.append(PageBreak())

# ─────────────────── Chapter 2: Finnhub API ───────────────────
story.append(Paragraph('2. Finnhub API (강력 권장)', STYLE_H1))
story.append(Paragraph(
    b('역할:') + ' 실시간 시세 (Yahoo 보조) + 애널리스트 컨센서스 + 어닝 캘린더 + 종목 뉴스 14일 + '
    '<b>임원 매수/매도 12주 (v49.57 신규)</b> + Short Interest. 종목 분석의 핵심.', STYLE_BODY))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('2.1 키 발급', STYLE_H2))
steps_fh = [
    '<b>① 웹사이트:</b> ' + link('https://finnhub.io/register', 'https://finnhub.io/register'),
    '<b>② 회원가입:</b> 이메일 + 비밀번호. 신용카드 불필요',
    '<b>③ 대시보드 진입 즉시 API 키 표시:</b> 우측 상단 Dashboard 카드에 <font face="Courier">cv...</font> 형식 키 노출',
    '<b>④ 복사:</b> 키는 언제든 재확인 가능 (Claude와 달리 안전)',
]
for s in steps_fh:
    story.append(Paragraph('• ' + s, STYLE_BULLET))

story.append(Paragraph('2.2 AIO 사이트 등록', STYLE_H2))
story.append(Paragraph('사이드바 → "API 키 설정" → <b>Finnhub API 키</b> 입력란에 붙여넣기 → 저장', STYLE_BODY))

story.append(Paragraph('2.3 무료 한도 + 활용 범위', STYLE_H2))
fh_table = [
    ['항목', '무료 한도', '용도'],
    ['Rate Limit', '60 req/min', '동시 사용자 5명 충분'],
    ['Quote (시세)', '무제한', 'Yahoo 백업'],
    ['Recommendation', '∞', '매수/보유/매도 컨센서스'],
    ['Earnings Calendar', '∞', '향후 60일 어닝 일정'],
    ['Company News', '∞', '최근 14일 헤드라인 (v49.57)'],
    ['Insider Transactions', '∞', '임원 매수/매도 12주 (v49.57)'],
    ['Stock Metric', '∞', 'Short Interest %'],
]
story.append(card_table(fh_table, [50*mm, 35*mm, 85*mm]))
story.append(Paragraph(b('🚀 v49.57 신규:') + ' Company News + Insider Transactions가 AI 채팅에 자동 주입되어 환각 차단 효과 큼.', STYLE_OK))

story.append(PageBreak())

# ─────────────────── Chapter 3: FMP API ───────────────────
story.append(Paragraph('3. FMP API (권장)', STYLE_H1))
story.append(Paragraph(
    b('역할:') + ' Financial Modeling Prep. PER/PBR/PEG/EV/EBITDA + 손익계산서 + 매출 세그먼트 + '
    '애널리스트 목표가. <b>밸류에이션 분석의 핵심.</b>', STYLE_BODY))

story.append(Paragraph('3.1 키 발급', STYLE_H2))
steps_fmp = [
    '<b>① 웹사이트:</b> ' + link('https://financialmodelingprep.com/developer/docs/', 'https://financialmodelingprep.com/'),
    '<b>② 우측 상단 "Get my API Key" → Sign Up:</b> Google/이메일',
    '<b>③ Dashboard → API Keys:</b> 자동 생성된 키 복사 (32자 영숫자)',
    '<b>④ Free Plan 자동 적용:</b> 250 req/day, 신용카드 불필요',
]
for s in steps_fmp:
    story.append(Paragraph('• ' + s, STYLE_BULLET))

story.append(Paragraph('3.2 AIO 사이트 등록', STYLE_H2))
story.append(Paragraph('사이드바 → "API 키 설정" → <b>FMP API 키</b> 입력란에 붙여넣기 → 저장', STYLE_BODY))

story.append(Paragraph('3.3 무료 한도 (250 req/day) — 효율 운용', STYLE_H2))
story.append(Paragraph(
    '250 req/day는 <b>종목당 4개 호출</b> (ratios + profile + income + price-target) 기준 '
    '<b>약 60개 종목/일</b>. 캐시로 동일 종목 재조회 차단됨.', STYLE_BODY))
story.append(Paragraph(
    b('🎯 권장 운용:') + ' 매일 관심 종목 10~20개 분석 + 채팅에서 종목 질의 시 자동 fetch. '
    '한도 초과 시 503 응답 → AIO가 "FMP 한도 초과 — 내일 재시도" 안내 후 다른 데이터로 답변 계속.', STYLE_TIP))

story.append(PageBreak())

# ─────────────────── Chapter 4: FRED API ───────────────────
story.append(Paragraph('4. FRED API (선택)', STYLE_H1))
story.append(Paragraph(
    b('역할:') + ' Federal Reserve Economic Data. CPI / 실업률 / Fed Funds Rate / 10Y 금리 / '
    'GDP / PCE 등 <b>매크로 지표 시계열 12개월</b>. 매크로 페이지 + 거시 환경 분석 핵심.', STYLE_BODY))

story.append(Paragraph('4.1 키 발급 (5분 소요)', STYLE_H2))
steps_fred = [
    '<b>① 웹사이트:</b> ' + link('https://fredaccount.stlouisfed.org/login/secure/', 'https://fredaccount.stlouisfed.org/'),
    '<b>② "Create New Account":</b> 이메일 + 비밀번호',
    '<b>③ 이메일 인증 (5분 대기):</b> 받은편지함 → 인증 링크 클릭',
    '<b>④ 로그인 → "API Keys" → "Request API Key":</b> 사용 목적 영문 한 줄 입력 (예: "Personal investing dashboard")',
    '<b>⑤ 즉시 발급:</b> 32자 소문자+숫자 키 (예: <font face="Courier">abcdef123456...</font>)',
]
for s in steps_fred:
    story.append(Paragraph('• ' + s, STYLE_BULLET))

story.append(Paragraph('4.2 AIO 사이트 등록', STYLE_H2))
story.append(Paragraph('사이드바 → "API 키 설정" → <b>FRED API 키</b> 입력란에 붙여넣기 → 저장', STYLE_BODY))

story.append(Paragraph(
    b('💡 무료 한도:') + ' 사실상 <b>무제한</b> (rate limit 명시 없음, 분당 120회 권장). '
    '연구 목적 무료 제공이므로 마음껏 사용 가능.', STYLE_OK))

story.append(Paragraph(
    b('⚠ 키 없을 때:') + ' AIO는 FRED 키 없으면 정적 fallback 시계열 사용 (월간 수동 갱신). '
    '실시간 매크로 지표 원하면 반드시 등록 권장.', STYLE_WARN))

story.append(PageBreak())

# ─────────────────── Chapter 5: Perplexity API ───────────────────
story.append(Paragraph('5. Perplexity API (선택)', STYLE_H1))
story.append(Paragraph(
    b('역할:') + ' 실시간 웹 검색 + 인용 출처 자동 첨부. "오늘 NVDA 발표 뉴스" 같은 질문 시 LLM이 학습 데이터 환각 대신 '
    '실제 웹 검색 결과로 답변. <b>v49.57부터 Claude 네이티브 web_search로 대체 가능</b> (선택성 ↑).', STYLE_BODY))

story.append(Paragraph('5.1 키 발급', STYLE_H2))
steps_pp = [
    '<b>① 웹사이트:</b> ' + link('https://www.perplexity.ai/settings/api', 'https://www.perplexity.ai/settings/api'),
    '<b>② Perplexity Pro 구독 필요</b> ($20/월) — 무료 티어 없음',
    '<b>③ Settings → API → "Generate" 버튼:</b> 키 즉시 발급 (<font face="Courier">pplx-...</font> 형식)',
    '<b>④ $5 무료 크레딧</b> 자동 충전 (Pro 구독 보너스)',
]
for s in steps_pp:
    story.append(Paragraph('• ' + s, STYLE_BULLET))

story.append(Paragraph('5.2 비용 (모델별)', STYLE_H2))
pp_table = [
    ['모델', '입력 (1M)', '출력 (1M)', '검색 (1K)'],
    ['sonar-small-online', '$0.20', '$0.20', '$5'],
    ['sonar-large-online', '$1', '$1', '$5'],
    ['sonar-huge-online', '$5', '$5', '$5'],
]
story.append(card_table(pp_table, [50*mm, 30*mm, 30*mm, 60*mm]))

story.append(Paragraph(
    b('🆓 v49.57 대안: Claude 네이티브 web_search') + '<br/>'
    'Perplexity 키 없어도 <b>Claude API의 내장 웹 검색 도구</b>를 사용 가능. '
    'AIO가 자동 트리거 (시점 키워드 / 티커+이벤트). max_uses 3 제한으로 비용 가드. '
    'localStorage.aio_web_search_enabled=\'off\'로 끄기 가능.', STYLE_OK))

story.append(PageBreak())

# ─────────────────── Chapter 6: 검증 ───────────────────
story.append(Paragraph('6. 키 등록 후 검증', STYLE_H1))
story.append(Paragraph(
    '키 5개 모두 등록했으면 사이트가 정상 동작하는지 self-check 해야 합니다. '
    'AIO에는 <b>11가지 audit 함수</b>가 내장되어 콘솔에서 확인 가능.', STYLE_BODY))

story.append(Paragraph('6.1 사이트 자체 검증 (콘솔 명령)', STYLE_H2))
story.append(Paragraph('F12 → Console 탭에서 다음 명령 실행:', STYLE_SMALL))
story.append(Paragraph(
    '<font color="#7afff0">// 등록된 API 키 5개 마스킹 확인</font><br/>'
    'AIO.diag.maskedApiKeys()<br/><br/>'
    '<font color="#7afff0">// 모든 자동화 운영 준비도 (27 axes)</font><br/>'
    'AIO.getAutoOpsReadiness()<br/><br/>'
    '<font color="#7afff0">// v49.57 신규: 종목 등록 정합성</font><br/>'
    'AIO.assertTickerRegistryCompleteness()<br/><br/>'
    '<font color="#7afff0">// 테마별 API 채널 가용성 (예: AI 테마)</font><br/>'
    'AIO.getThemeFetchCoverageAudit(\'ai\')<br/><br/>'
    '<font color="#7afff0">// 웹 검색 통계</font><br/>'
    'AIO.getWebSearchAudit()<br/><br/>'
    '<font color="#7afff0">// 회귀 테스트 전수 (498개)</font><br/>'
    'AIO.runTests()', STYLE_CODE))

story.append(Paragraph('6.2 종목 분석 동작 테스트', STYLE_H2))
story.append(Paragraph(
    '1. 좌측 메뉴 → <b>"기업 분석"</b> 페이지 → 검색창에 "NVDA" 입력', STYLE_BODY))
story.append(Paragraph(
    '2. 다음 데이터가 표시되면 정상: '
    '<font color="#3ddba5">✓ 가격</font> (Yahoo) · '
    '<font color="#3ddba5">✓ PER/PBR/PEG</font> (FMP) · '
    '<font color="#3ddba5">✓ 컨센서스</font> (Finnhub) · '
    '<font color="#3ddba5">✓ 어닝 일정</font> (Finnhub) · '
    '<font color="#3ddba5">✓ SEC 10-K</font> (무료) · '
    '<font color="#3ddba5">✓ Wikipedia</font> (무료)', STYLE_BODY))
story.append(Paragraph(
    '3. 채팅창에 <b>"오늘 엔비디아 뉴스"</b> 입력 → '
    '"🔍 Claude 네이티브 웹 검색 활성화" 보라색 배지 표시 + 응답에 검색 결과 인용', STYLE_BODY))

story.append(Paragraph('6.3 회귀 테스트 결과 해석', STYLE_H2))
story.append(Paragraph(
    'AIO.runTests() 결과 <b>"498/498 PASS"</b>면 완벽. <b>"483/498 PASS"</b> 정도면 정상 '
    '(15개 pre-existing failures는 KR 종목 가격 잔존 문제, 무시 가능).', STYLE_BODY))
story.append(Paragraph(
    b('⚠ 100개 이상 FAIL') + ' 시 API 키 미입력 또는 잘못된 키일 가능성. <b>AIO.diag.maskedApiKeys()</b>로 키 5개 모두 등록 확인.', STYLE_WARN))

story.append(PageBreak())

# ─────────────────── Chapter 7: 비용 관리 + 트러블슈팅 ───────────────────
story.append(Paragraph('7. 비용 관리 + 백업 + 트러블슈팅', STYLE_H1))

story.append(Paragraph('7.1 월 예상 비용 (5명 사용자 기준)', STYLE_H2))
cost_table = [
    ['API', '플랜', '월 비용', '제약'],
    ['Claude', '종량제', '$3~10/사용자', '월 한도 $20~50 설정 권장'],
    ['Finnhub', 'Free', '$0', '60 req/min — 5명 동시 OK'],
    ['FMP', 'Free', '$0', '250 req/day — 캐시로 충분'],
    ['FRED', 'Free', '$0', '무제한'],
    ['Perplexity', 'Pro', '$20 OR $0', 'Claude web_search로 대체 가능'],
]
story.append(card_table(cost_table, [30*mm, 25*mm, 30*mm, 85*mm]))
story.append(Paragraph(
    b('💰 최저 비용 운용:') + ' Claude만 등록하고 나머지 모두 무료 사용 → <b>월 $3~10/사용자</b>. '
    'Perplexity 생략 + v49.57 Claude web_search 활용.', STYLE_OK))

story.append(Paragraph('7.2 API 키 백업 + 복원', STYLE_H2))
story.append(Paragraph(
    'localStorage는 캐시 클리어, 시크릿 모드, 다른 기기 사용 시 키가 모두 사라집니다. '
    '<b>v49.45 IndexedDB 자동 백업 + 수동 export 명령으로 안전 보장.</b>', STYLE_BODY))
story.append(Paragraph(
    '<font color="#7afff0">// 키 입력 직후 콘솔에서 1회 실행 (JSON 다운로드)</font><br/>'
    'AIO.exportApiKeys({masked: false})<br/><br/>'
    '<font color="#7afff0">// 캐시 클리어 후 자동 복원 (IndexedDB에서)</font><br/>'
    'AIO.recoverApiKeysFromIdb()<br/><br/>'
    '<font color="#7afff0">// JSON 파일에서 수동 복원</font><br/>'
    'AIO.importApiKeys(jsonText)', STYLE_CODE))

story.append(Paragraph('7.3 자주 묻는 문제', STYLE_H2))
faq_table = [
    ['증상', '원인', '해결'],
    ['"API 키 없음" 에러', 'Claude 키 미입력', '사이드바에서 sk-ant-... 키 등록'],
    ['데이터 모두 "—"', 'SW 캐시 stale', 'Ctrl+Shift+R 강력 새로고침'],
    ['종목 가격 안 보임', 'Yahoo CORS 차단', '몇 분 후 재시도 (proxy chain auto-fallback)'],
    ['"503 한도 초과"', 'FMP 250/day 초과', '24시간 후 자동 복구 또는 paid plan'],
    ['AI 답변 환각', 'web_search 미트리거', 'localStorage.aio_web_search_enabled=\'on\''],
    ['키 모두 날아감', '캐시 클리어 / 시크릿', 'AIO.recoverApiKeysFromIdb() 실행'],
]
story.append(card_table(faq_table, [50*mm, 40*mm, 80*mm]))

story.append(PageBreak())

# ─────────────────── Chapter 8: 부록 ───────────────────
story.append(Paragraph('8. 부록 — v49.57 신규 기능 + 무료 API 매트릭스', STYLE_H1))

story.append(Paragraph('8.1 v49.57 핵심 기능 (2026-05-20)', STYLE_H2))
v4957_table = [
    ['카테고리', 'v49.56 이전', 'v49.57', '효과'],
    ['종목 REGISTRY', '47개', '152개 (KR 5 추가)', '한글 검색 정합'],
    ['SEC CIK_MAP', '50개', '134개', '10-K/8-K fetch 가능'],
    ['채팅 데이터 소스', '2개 (10-K+Wiki)', '6개 (+8-K/News/Insider/13F)', '환각 차단 강화'],
    ['웹 검색', 'Perplexity (유료)', '+Claude 내장 (조건부)', '추가 비용 0'],
    ['테마 컨텍스트', '정적 ETF만', '+활성 테마 라이브', '동적 분석'],
    ['Audit 함수', '24개', '27개 (3 신규)', '자가 진단'],
]
story.append(card_table(v4957_table, [35*mm, 35*mm, 50*mm, 50*mm]))

story.append(Paragraph('8.2 검색 API 없이도 가능한 영역 (정량 80% + 정성 70%)', STYLE_H2))
api_matrix = [
    ['데이터 종류', '소스', '커버', '검색 API 필요?'],
    ['실시간 시세', 'Yahoo (무료) + Naver + CoinGecko', '✓ 100%', '✗'],
    ['펀더멘털', 'FMP + Finnhub + Yahoo', '✓ 95%', '✗'],
    ['사업 설명', 'SEC 10-K (Item 1)', '✓ 100%', '✗'],
    ['리스크 요인', 'SEC 10-K (Item 1A)', '✓ 100%', '✗'],
    ['경영진/CEO', 'Wikipedia', '✓ 90%', '✗'],
    ['어닝 일정', 'Finnhub /calendar', '✓ 100%', '✗'],
    ['임원 매매 (12주)', 'Finnhub /insider (v49.57)', '✓ 95%', '✗'],
    ['최근 8-K 이벤트', 'SEC /submissions (v49.57)', '✓ 100%', '✗'],
    ['종목 뉴스 (14일)', 'Finnhub /company-news (v49.57)', '✓ 95%', '✗'],
    ['13F 기관 보유', 'SEC + WhaleWisdom URL', '✓ 80%', '✗'],
    ['트렌딩 뉴스', '검색 API 또는 Claude web_search', '⚠ 70%', '✓ (둘 중 하나)'],
    ['애널 리포트 본문', 'Morningstar (유료)', '✗ 30%', '✓'],
    ['소셜 sentiment', 'X/Reddit API (유료)', '✗ 20%', '✓'],
]
story.append(card_table(api_matrix, [40*mm, 60*mm, 25*mm, 45*mm]))

story.append(PageBreak())

# ─────────────────── 마지막 페이지: 빠른 시작 ───────────────────
story.append(Paragraph('🚀 빠른 시작 (15분 루틴)', STYLE_H1))
story.append(Spacer(1, 4*mm))

quick = [
    ('1', '⏱ 2분', 'console.anthropic.com → 가입 → Create Key → sk-ant-... 복사', '#a855f7'),
    ('2', '⏱ 3분', 'finnhub.io/register → 가입 → Dashboard 키 cv... 복사', '#00d4ff'),
    ('3', '⏱ 3분', 'financialmodelingprep.com → 가입 → API Keys 복사', '#3ddba5'),
    ('4', '⏱ 5분', 'fredaccount.stlouisfed.org → 가입 → 이메일 인증 → Request API Key', '#ffa31a'),
    ('5', '⏱ 2분', 'ysnle.github.io/aio-screener/ 접속 → ☰ 메뉴 → API 키 4개 붙여넣기 → 저장', '#ff5b50'),
    ('6', '✓ 검증', 'F12 콘솔 → AIO.diag.maskedApiKeys() → 4개 키 마스킹 확인 → 채팅에 "NVDA 분석" 입력', '#7e8a9e'),
]
for num, time, action, color in quick:
    row = [
        Paragraph(f'<font color="{color}" size="20"><b>{num}</b></font>', ParagraphStyle('QNum', fontName='MalgunBd', alignment=TA_CENTER)),
        Paragraph(f'<b>{time}</b><br/>{action}', STYLE_BODY),
    ]
    t = Table([row], colWidths=[15*mm, 155*mm])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,0), (-1,-1), COLOR_BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.3, COLOR_MUTED),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LINEBEFORE', (0,0), (0,-1), 4, colors.HexColor(color)),
    ]))
    story.append(t)
    story.append(Spacer(1, 3*mm))

story.append(Spacer(1, 8*mm))
story.append(Paragraph(b('🎯 완료 후 권장 첫 액션'), STYLE_H2))
story.append(Paragraph(
    '<b>1.</b> 콘솔에서 <font face="Courier">AIO.exportApiKeys({masked:false})</font> 실행 → JSON 백업 다운로드<br/>'
    '<b>2.</b> 사이드바 → "포트폴리오" → 보유 종목 입력 (분석에 자동 반영)<br/>'
    '<b>3.</b> 사이드바 → "워치리스트" → 관심 종목 등록 (실시간 가격 자동 갱신)<br/>'
    '<b>4.</b> 매일 아침 "브리핑" 페이지로 시작 — 시장 환경 + 액션 아이템 자동 생성', STYLE_BODY))

story.append(Spacer(1, 12*mm))
story.append(hr())
story.append(Spacer(1, 4*mm))
story.append(Paragraph(
    '문의 / 버그 신고 / 기능 요청: ' + link('github.com/ysnle/aio-screener', 'https://github.com/ysnle/aio-screener') +
    '<br/>사이트: ' + link('ysnle.github.io/aio-screener', 'https://ysnle.github.io/aio-screener/') +
    '<br/>본 PDF 생성: AIO Screener v49.57 · 2026년 5월 20일',
    STYLE_SMALL))

# ── 빌드 ──
doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=20*mm, rightMargin=20*mm,
    topMargin=18*mm, bottomMargin=20*mm,
    title='AIO Screener API Setup Guide v49.57',
    author='AIO Screener',
    subject='API 가이드 + 초기 설정 방법',
)

doc.build(story, onFirstPage=on_page, onLaterPages=on_page)

import os, sys
sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None
try:
    print(f'[OK] PDF generated: {OUTPUT}')
    print(f'     size: {os.path.getsize(OUTPUT) / 1024:.1f} KB')
except Exception:
    pass

# pdf page count (pypdf 설치 시)
try:
    from pypdf import PdfReader
    r = PdfReader(OUTPUT)
    print(f'     pages: {len(r.pages)}')
except Exception:
    pass
