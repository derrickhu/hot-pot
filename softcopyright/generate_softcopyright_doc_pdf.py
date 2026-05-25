#!/usr/bin/env python3
"""
软件著作权登记 - 文档鉴别材料（设计说明书）PDF 生成工具
====================================================
严格按中国版权保护中心常用提交要求:
  1. A4 纸张, 纵向
  2. 页眉左侧: 软件全称 + 版本号 (与申请表完全一致)
  3. 页眉右侧: 阿拉伯数字连续页码
  4. 页脚: 申请人名称
  5. 每页不少于 30 行 (有图除外)
  6. 不足 60 页全部提交, 超过 60 页取前 30 页 + 后 30 页
  7. 文档类型: 设计说明书
  8. 截图缺失时生成占位框, 后续补图后重跑脚本即可替换
"""

import warnings
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import WrapMode
from PIL import Image

warnings.filterwarnings("ignore", category=DeprecationWarning)

# ======================= 配置区 =======================

ROOT = Path(__file__).resolve().parents[1]
SOFTCOPYRIGHT_DIR = ROOT / 'softcopyright'
OUTPUT = SOFTCOPYRIGHT_DIR / '软著文档-别捞水果-V1.0.0.pdf'

SOFTWARE_FULL_NAME = '深圳幸运呱科技有限公司别捞水果小游戏软件'
SOFTWARE_VERSION = 'V1.0.0'
APPLICANT_NAME = '深圳幸运呱科技有限公司'

SONGTI_PATH = '/System/Library/Fonts/Supplemental/Songti.ttc'

BODY_FONT_SIZE = 10.5
H1_FONT_SIZE = 16
H2_FONT_SIZE = 14
H3_FONT_SIZE = 12
CODE_FONT_SIZE = 9
HEADER_FONT_SIZE = 10
FOOTER_FONT_SIZE = 9

LINE_HEIGHT = 6.5
CODE_LINE_HEIGHT = 5.0
H1_LINE_HEIGHT = 10
H2_LINE_HEIGHT = 8.5
H3_LINE_HEIGHT = 7.5

LEFT_MARGIN = 25
RIGHT_MARGIN = 20
TOP_MARGIN = 15
BOTTOM_MARGIN = 15

PAGE_W = 210
PAGE_H = 297
CONTENT_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN
CONTENT_TOP = TOP_MARGIN + 10
HEADER_TEXT = f'{SOFTWARE_FULL_NAME} {SOFTWARE_VERSION} 设计说明书'

PICS_DIR = SOFTCOPYRIGHT_DIR / 'pics'
PIC_SPECS = [
    ('01_home.jpg', '图1  首页主界面 - 三种玩法入口与底部功能入口', '需要截取首页，能看到“别捞水果”Logo、关卡模式、每日限定、切水果入口。'),
    ('02_bowl_game.jpg', '图2  关卡玩法界面 - 碗内食材、订单盘与暂存区', '需要截取普通关卡进行中画面，包含顶部订单盘、碗、底部加菜碟/移除/打乱工具。'),
    ('03_bowl_clear.jpg', '图3  关卡通关界面 - 解锁内容与通关数据', '需要截取通关成功弹窗，包含解锁内容、近30天通关数据和下一关按钮。'),
    ('04_bowl_fail.jpg', '图4  关卡失败复活界面 - 订单进度与复活操作', '需要截取挑战失败/复活弹窗，包含看广告复活、重玩本关、返回首页。'),
    ('05_daily_limited.jpg', '图5  每日限定界面 - 目标水果与暂存策略', '需要截取每日限定玩法进行中画面，能看到目标订单、暂存区域和道具按钮。'),
    ('06_fruit_slice.jpg', '图6  切水果无尽界面 - 水果网格与管道区域', '需要截取切水果无尽模式进行中画面，包含水果网格、管道、分数和工具。'),
    ('07_catalog.jpg', '图7  图鉴界面 - 食材解锁进度', '需要截取图鉴/收藏界面，展示已解锁食材列表或详情。'),
    ('08_gacha.jpg', '图8  扭蛋界面 - 奖励抽取与道具库存', '需要截取扭蛋界面，展示抽取入口、奖励或库存信息。'),
    ('09_leaderboard.jpg', '图9  排行榜界面 - 玩家进度排名', '需要截取排行榜界面，展示世界榜或好友榜列表。'),
    ('10_settings.jpg', '图10  设置界面 - 音频与返回控制', '需要截取设置/暂停弹窗，展示音乐音效开关、继续/返回等控制。'),
]


class DocPDF(FPDF):
    """设计说明书 PDF 类, 统一页眉页脚和常用写入方法。"""

    def __init__(self):
        super().__init__(orientation='P', unit='mm', format='A4')
        self.set_left_margin(LEFT_MARGIN)
        self.set_right_margin(RIGHT_MARGIN)
        self.set_top_margin(CONTENT_TOP)
        self.set_auto_page_break(auto=True, margin=BOTTOM_MARGIN + 10)

    def header(self):
        self.set_font('Songti', '', HEADER_FONT_SIZE)
        self.set_text_color(0, 0, 0)
        self.set_xy(LEFT_MARGIN, TOP_MARGIN)
        self.cell(0, 6, HEADER_TEXT, new_x="LEFT", new_y="TOP")

        page_str = str(self.page_no())
        tw = self.get_string_width(page_str)
        self.set_xy(PAGE_W - RIGHT_MARGIN - tw, TOP_MARGIN)
        self.cell(tw, 6, page_str, new_x="LEFT", new_y="TOP")

        line_y = TOP_MARGIN + 7
        self.set_draw_color(0, 0, 0)
        self.set_line_width(0.4)
        self.line(LEFT_MARGIN, line_y, PAGE_W - RIGHT_MARGIN, line_y)
        self.set_y(CONTENT_TOP)

    def footer(self):
        self.set_xy(LEFT_MARGIN, PAGE_H - BOTTOM_MARGIN)
        self.set_font('Songti', '', FOOTER_FONT_SIZE)
        self.set_text_color(0, 0, 0)
        self.cell(CONTENT_W, 5, APPLICANT_NAME, align='C')

    def check_page_break(self, h):
        if self.get_y() + h > PAGE_H - BOTTOM_MARGIN - 10:
            self.add_page()

    def write_h1(self, text):
        self.check_page_break(H1_LINE_HEIGHT + 4)
        self.ln(4)
        self.set_font('Songti', '', H1_FONT_SIZE)
        self.set_text_color(0, 0, 0)
        self.set_x(LEFT_MARGIN)
        self.cell(CONTENT_W, H1_LINE_HEIGHT, safe_text(text), new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def write_h2(self, text):
        self.check_page_break(H2_LINE_HEIGHT + 3)
        self.ln(3)
        self.set_font('Songti', '', H2_FONT_SIZE)
        self.set_text_color(0, 0, 0)
        self.set_x(LEFT_MARGIN)
        self.cell(CONTENT_W, H2_LINE_HEIGHT, safe_text(text), new_x="LMARGIN", new_y="NEXT")
        self.ln(1.5)

    def write_h3(self, text):
        self.check_page_break(H3_LINE_HEIGHT + 2)
        self.ln(2)
        self.set_font('Songti', '', H3_FONT_SIZE)
        self.set_text_color(0, 0, 0)
        self.set_x(LEFT_MARGIN)
        self.cell(CONTENT_W, H3_LINE_HEIGHT, safe_text(text), new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def write_body(self, text, indent=0):
        self.set_font('Songti', '', BODY_FONT_SIZE)
        self.set_text_color(30, 30, 30)
        self.set_x(LEFT_MARGIN + indent)
        self.multi_cell(CONTENT_W - indent, LINE_HEIGHT, safe_text(text), new_x="LMARGIN", new_y="NEXT", wrapmode=WrapMode.CHAR)

    def write_bullet(self, text, level=0):
        indent = 4 + level * 4
        bullet = '  ' * level + ('- ' if level > 0 else '* ')
        self.write_body(bullet + text, indent=indent)

    def write_code_block(self, lines):
        self.ln(1)
        self.set_font('Songti', '', CODE_FONT_SIZE)
        self.set_text_color(40, 40, 40)
        for line in lines:
            self.check_page_break(CODE_LINE_HEIGHT)
            self.set_fill_color(245, 245, 245)
            self.set_x(LEFT_MARGIN + 4)
            self.cell(CONTENT_W - 4, CODE_LINE_HEIGHT, safe_text(line.replace('\t', '    ')), fill=True, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def write_table_auto(self, headers, rows, col_widths=None):
        self.ln(1)
        if col_widths is None:
            col_widths = [CONTENT_W / len(headers)] * len(headers)

        self.set_font('Songti', '', BODY_FONT_SIZE)
        self.set_fill_color(230, 230, 230)
        self.set_text_color(0, 0, 0)
        cx = LEFT_MARGIN
        for i, h in enumerate(headers):
            self.set_x(cx)
            self.cell(col_widths[i], LINE_HEIGHT, safe_text(h), border=1, fill=True, new_x="LEFT", new_y="TOP")
            cx += col_widths[i]
        self.ln(LINE_HEIGHT)

        self.set_fill_color(255, 255, 255)
        self.set_text_color(30, 30, 30)
        for row in rows:
            self.check_page_break(LINE_HEIGHT)
            cx = LEFT_MARGIN
            for i, cell in enumerate(row):
                self.set_x(cx)
                self.cell(col_widths[i], LINE_HEIGHT, safe_text(str(cell)), border=1, new_x="LEFT", new_y="TOP")
                cx += col_widths[i]
            self.ln(LINE_HEIGHT)
        self.ln(1)

    def write_image_or_placeholder(self, filename, caption, requirement, max_h=95):
        img_path = PICS_DIR / filename
        if img_path.exists():
            self.write_image(img_path, caption, max_h=max_h)
            return
        self.write_placeholder(filename, caption, requirement)

    def write_image(self, img_path, caption='', max_h=95):
        img = Image.open(img_path)
        iw, ih = img.size
        max_w = CONTENT_W * 0.48
        ratio = min(max_w / iw, max_h / ih)
        draw_w = iw * ratio
        draw_h = ih * ratio
        total_h = draw_h + 18
        self.check_page_break(total_h)
        self.ln(3)
        x = LEFT_MARGIN + (CONTENT_W - draw_w) / 2
        self.image(str(img_path), x=x, y=self.get_y(), w=draw_w, h=draw_h)
        self.set_y(self.get_y() + draw_h + 2)
        self.write_caption(caption)
        self.ln(3)

    def write_placeholder(self, filename, caption, requirement):
        box_w = CONTENT_W * 0.62
        box_h = 72
        self.check_page_break(box_h + 20)
        self.ln(3)
        x = LEFT_MARGIN + (CONTENT_W - box_w) / 2
        y = self.get_y()
        self.set_draw_color(150, 150, 150)
        self.set_line_width(0.4)
        self.rect(x, y, box_w, box_h)
        self.set_fill_color(245, 245, 245)
        self.rect(x + 1, y + 1, box_w - 2, box_h - 2, style='F')

        self.set_font('Songti', '', 11)
        self.set_text_color(80, 80, 80)
        self.set_xy(x + 4, y + 10)
        self.multi_cell(box_w - 8, 6, safe_text(f'截图占位: {filename}'), align='C', wrapmode=WrapMode.CHAR)
        self.set_font('Songti', '', 9)
        self.set_xy(x + 8, y + 28)
        self.multi_cell(box_w - 16, 5.5, safe_text(requirement), align='C', wrapmode=WrapMode.CHAR)
        self.set_y(y + box_h + 2)
        self.write_caption(caption)
        self.ln(3)

    def write_caption(self, caption):
        if not caption:
            return
        self.set_font('Songti', '', 9)
        self.set_text_color(100, 100, 100)
        self.set_x(LEFT_MARGIN)
        self.cell(CONTENT_W, 5, safe_text(caption), align='C', new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(30, 30, 30)

    def write_spacer(self, h=3):
        self.ln(h)


def safe_text(text):
    """替换宋体无法渲染的特殊字符。"""
    replacements = {
        '→': '->',
        '←': '<-',
        '↑': '^',
        '↓': 'v',
        '✅': '[OK]',
        '⚠': '[!]',
        '★': '*',
        '…': '...',
        '—': '-',
        '“': '"',
        '”': '"',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return ''.join(c if ord(c) <= 0xFFFF else '?' for c in text)


def pic(filename):
    for item in PIC_SPECS:
        if item[0] == filename:
            return item
    raise KeyError(filename)


def write_document(pdf):
    pdf.add_page()
    pdf.write_h1('目  录')
    for item in [
        '一、引言',
        '    1.1 编写目的',
        '    1.2 软件概述',
        '    1.3 运行环境',
        '    1.4 术语与缩略语',
        '二、软件总体设计',
        '    2.1 软件需求概括',
        '    2.2 总体架构设计',
        '    2.3 模块划分与关系',
        '    2.4 场景系统设计',
        '三、核心模块详细设计',
        '    3.1 游戏入口模块',
        '    3.2 场景管理模块',
        '    3.3 捞水果关卡玩法模块',
        '    3.4 每日限定玩法模块',
        '    3.5 切水果无尽玩法模块',
        '    3.6 图鉴、扭蛋与排行榜模块',
        '    3.7 云同步与数据上报模块',
        '四、数据结构设计',
        '五、数据接口设计',
        '六、出错处理设计',
        '七、性能优化设计',
    ]:
        pdf.write_body(item)

    pdf.write_h1('一、引言')
    pdf.write_h2('1.1 编写目的')
    pdf.write_body(
        '编写本设计说明书是软件开发过程的重要组成部分。本文档旨在详细描述'
        '深圳幸运呱科技有限公司别捞水果小游戏软件（以下简称"本软件"）的软件架构设计、'
        '核心模块设计、数据结构设计、接口设计及出错处理设计，为软件著作权登记提供技术性文档依据。'
    )
    pdf.write_body(
        '本文档面向软件著作权审查人员，全面展示本软件的技术架构、设计思路和实现方案，'
        '证明本软件为独立开发的原创作品。'
    )

    pdf.write_h2('1.2 软件概述')
    pdf.write_body(
        '本软件是一款基于微信小游戏平台的休闲益智类水果主题小游戏。游戏以"从水果碗中捞取水果并完成订单"'
        '为核心体验，融合了订单目标、暂存区策略、道具救场、每日限定挑战、切水果无尽模式、图鉴收集、'
        '扭蛋奖励、排行榜和云端同步等功能。玩家需要在限定的暂存空间和不断变化的水果池中做出选择，'
        '完成关卡订单并解锁更多水果内容。'
    )
    pdf.write_body('本软件的主要功能包括:')
    for feature in [
        '捞水果关卡玩法: 玩家从水果碗中点击食材，按顶部订单盘要求完成指定水果订单',
        '暂存区策略系统: 非目标食材进入底部菜碟，菜碟满时触发失败或复活流程',
        '道具系统: 加菜碟、移除、打乱等工具用于提高容错和改变局势',
        '每日限定玩法: 每日生成特定饮品主题目标，支持分享配方和额外奖励',
        '切水果无尽玩法: 通过水果网格合成、管道管理和里程碑奖励形成长线挑战',
        '图鉴系统: 记录水果解锁进度、展示食材图标和收集状态',
        '扭蛋系统: 使用金币抽取道具或奖励，形成局外资源循环',
        '排行榜系统: 展示玩家进度和挑战表现，支持世界榜与好友榜能力',
        '云同步系统: 支持本地进度与云端存档同步，保障跨设备数据一致',
        '数据分析系统: 上报玩法进入、关卡通关、失败、道具使用等事件，用于运营分析',
    ]:
        pdf.write_bullet(feature)

    filename, caption, requirement = pic('01_home.jpg')
    pdf.write_image_or_placeholder(filename, caption, requirement)

    pdf.write_h2('1.3 运行环境')
    pdf.write_table_auto(
        ['项目', '要求'],
        [
            ['运行平台', '微信小游戏'],
            ['操作系统', 'iOS 10.0及以上 / Android 5.0及以上'],
            ['微信版本', '微信客户端 6.7.2 及以上'],
            ['屏幕方向', '竖屏(Portrait)'],
            ['开发语言', 'TypeScript / JavaScript (ES6+)'],
            ['渲染技术', 'PixiJS + WebGL/Canvas'],
            ['构建工具', 'Vite'],
            ['云服务', '微信云开发 / HTTP 云函数'],
            ['网络要求', '核心关卡可本地运行，云同步、排行榜、数据上报需要网络连接'],
        ],
        col_widths=[40, CONTENT_W - 40],
    )

    pdf.write_h2('1.4 术语与缩略语')
    pdf.write_table_auto(
        ['术语/缩略语', '含义说明'],
        [
            ['订单', '关卡中要求收集指定数量水果的目标单元'],
            ['暂存区', '底部菜碟区域，用于暂放无法立即交付订单的水果'],
            ['订单盘', '顶部用于显示当前订单目标和收集进度的盘子'],
            ['复活', '失败后通过广告或降级策略清空暂存区并继续本关'],
            ['每日限定', '按日期生成主题饮品目标的特殊挑战玩法'],
            ['无尽模式', '不固定关卡终点，以最高分和里程碑为目标的持续挑战玩法'],
            ['PixiJS', '用于小游戏渲染的 2D WebGL 渲染引擎'],
            ['Scene', '游戏场景，负责独立界面生命周期、渲染和输入处理'],
            ['SDK', 'Software Development Kit，软件开发工具包'],
            ['API', 'Application Programming Interface，应用程序接口'],
        ],
        col_widths=[35, CONTENT_W - 35],
    )

    pdf.write_h1('二、软件总体设计')
    pdf.write_h2('2.1 软件需求概括')
    pdf.write_body(
        '本软件采用模块化的软件设计方法，以微信小游戏框架为基础平台，使用 TypeScript 编写核心逻辑，'
        '通过 Vite 构建为小游戏可运行的 JavaScript 包。软件采用单页面应用架构，使用场景管理器切换首页、'
        '关卡、每日限定、切水果、图鉴、扭蛋、排行榜等功能界面。'
    )
    for need in [
        '高性能实时渲染: 游戏包含大量水果精灵、飞行动画、弹窗和粒子效果，需要稳定帧率',
        '准确触摸输入: 支持点击水果、点击工具、弹窗按钮和排行榜滚动等多类交互',
        '可靠进度存储: 关卡进度、金币、图鉴、道具库存和最高分需要本地持久化并可云端同步',
        '可扩展内容配置: 水果、关卡、主题、徽章、经济和每日限定数据均采用配置化管理',
        '稳定网络降级: 广告、排行、云同步和数据分析失败时不影响核心玩法继续运行',
    ]:
        pdf.write_bullet(need)

    pdf.write_h2('2.2 总体架构设计')
    pdf.write_body(
        '本软件采用"启动入口 + 引擎核心 + 场景系统 + 配置数据 + 服务模块 + 工具组件"的分层架构。'
        '入口层负责初始化画布、音频、分享、云同步和场景注册；引擎核心封装 PixiJS 应用、场景切换、'
        '平台适配和本地持久化；业务场景负责具体玩法和界面逻辑。'
    )
    pdf.write_body('系统整体模块信息如下:')
    pdf.write_table_auto(
        ['模块层', '模块名称', '功能简述'],
        [
            ['入口层', 'game.js / src/main.ts', '创建小游戏运行环境，初始化游戏核心并注册场景'],
            ['核心层', 'core/Game.ts', '封装 PixiJS 舞台、逻辑尺寸、Ticker 和安全区'],
            ['核心层', 'core/SceneManager.ts', '统一管理场景注册、预加载、切换和生命周期'],
            ['场景层', 'scenes/HomeScene.ts', '首页入口、金币栏、底部导航和玩法入口'],
            ['场景层', 'scenes/BowlScene.ts', '主关卡玩法，订单、碗、暂存区、道具和通关流程'],
            ['场景层', 'scenes/DailyLimitedScene.ts', '每日限定饮品挑战玩法'],
            ['场景层', 'scenes/FruitSliceEndlessScene.ts', '切水果无尽挑战玩法'],
            ['配置层', 'config/*.ts', '水果、关卡、主题、经济、云服务和素材路径配置'],
            ['服务层', 'services/*.ts / managers/*.ts', '排行榜、云同步、用户资料、隐私授权和数据上报'],
            ['云函数', 'cloudfunctions/*', '存档、鉴权、排行榜、数据接收和关卡通关率接口'],
        ],
        col_widths=[22, 55, CONTENT_W - 77],
    )

    pdf.write_h2('2.3 模块划分与关系')
    pdf.write_body('软件主要依赖关系如下:')
    pdf.write_code_block([
        'game.js',
        '  -> minigame/game-bundle.js',
        '     -> src/main.ts',
        '        -> core/Game.ts',
        '        -> core/SceneManager.ts',
        '        -> managers/CloudSyncManager.ts',
        '        -> scenes/HomeScene.ts',
        '        -> scenes/BowlScene.ts',
        '        -> scenes/DailyLimitedScene.ts',
        '        -> scenes/FruitSliceEndlessScene.ts',
        '        -> scenes/CatalogScene.ts / GachaScene.ts / LeaderboardScene.ts',
        '        -> config/*.ts / game/*.ts / gameobjects/*.ts / services/*.ts',
    ])
    pdf.write_body(
        '各场景通过 SceneManager 进行解耦，进入场景时执行 onEnter，离开场景时执行 onExit，'
        '需要提前准备资源的场景实现 prepare 或内部预加载流程。共享能力如音频、云同步、排行榜、'
        '纹理缓存和广告能力以服务模块形式提供，避免在场景之间直接耦合。'
    )

    pdf.write_h2('2.4 场景系统设计')
    pdf.write_table_auto(
        ['场景', '功能描述', '关键模块'],
        [
            ['home', '首页与玩法入口', 'HomeScene'],
            ['bowl', '主关卡玩法', 'BowlScene'],
            ['dailyLimited', '每日限定玩法', 'DailyLimitedScene'],
            ['fruitSlice', '切水果无尽玩法', 'FruitSliceEndlessScene'],
            ['catalog', '图鉴展示', 'CatalogScene'],
            ['gacha', '扭蛋抽奖', 'GachaScene'],
            ['leaderboard', '排行榜', 'LeaderboardScene'],
        ],
        col_widths=[32, 58, CONTENT_W - 90],
    )

    pdf.write_h1('三、核心模块详细设计')
    pdf.write_h2('3.1 游戏入口模块')
    pdf.write_body(
        '游戏入口由 game.js 与 src/main.ts 协同完成。game.js 作为微信小游戏启动文件，加载构建后的 bundle；'
        'src/main.ts 获取 Canvas、初始化 Game、设置分享、初始化数据分析、等待云同步启动门、注册所有场景，'
        '并根据玩家是否已有进度决定进入第一关或首页。'
    )
    pdf.write_code_block([
        'Game.init(canvas)',
        'setupWechatShare()',
        'initAnalytics()',
        'CloudSyncManager.prewarm()',
        'SceneManager.register(homeScene)',
        'SceneManager.register(bowlScene)',
        'SceneManager.switchTo(shouldEnterFirstLevel ? "bowl" : "home")',
    ])

    pdf.write_h2('3.2 场景管理模块')
    pdf.write_body(
        'SceneManager 负责维护场景注册表和当前场景引用。切换场景时，先调用旧场景 onExit 清理定时器、'
        '原生按钮和临时节点，再调用新场景 onEnter 挂载界面，确保同一时间只有一个业务场景响应输入。'
    )
    pdf.write_body(
        'LoadingOverlay 用于进入较重场景时展示进度，TextureCache 负责缓存已加载的纹理，'
        'loadBowlSubpackage 等工具函数负责按需加载分包资源，降低首包压力。'
    )

    pdf.write_h2('3.3 捞水果关卡玩法模块')
    pdf.write_body(
        'BowlScene 是主玩法核心模块，负责关卡定义读取、水果生成、订单分配、碗内点击、飞行动画、'
        '暂存区管理、失败复活、道具执行、通关奖励、徽章解锁和排行榜进度上报。'
    )
    filename, caption, requirement = pic('02_bowl_game.jpg')
    pdf.write_image_or_placeholder(filename, caption, requirement)
    pdf.write_body('捞水果关卡核心流程如下:')
    pdf.write_code_block([
        'startRound()',
        '  -> 读取关卡配置并生成水果池',
        '  -> 初始化订单盘、暂存槽和碗内水果',
        '  -> 玩家点击水果',
        '     -> 若匹配订单则飞入订单盘并更新进度',
        '     -> 否则飞入暂存区',
        '  -> 订单完成后补下一单并释放隐藏水果',
        '  -> 全部订单完成后展示通关界面',
        '  -> 暂存区满时展示失败复活界面',
    ])
    pdf.write_table_auto(
        ['子模块', '功能说明'],
        [
            ['订单系统', '根据关卡水果池分配订单，维护每个订单盘的目标水果和完成进度'],
            ['碗内水果系统', '管理水果位置、层级、飞行动画、冻结状态和隐藏释放策略'],
            ['暂存区系统', '管理底部菜碟容量、占用状态、紧迫态提醒和复活清空'],
            ['道具系统', '提供加菜碟、移除、打乱三类救场工具'],
            ['通关结算', '展示解锁内容、近30天通关数据、下一关和分享入口'],
            ['失败复活', '提供广告复活、重玩本关和返回首页入口'],
        ],
        col_widths=[35, CONTENT_W - 35],
    )
    for image_name in ['03_bowl_clear.jpg', '04_bowl_fail.jpg']:
        filename, caption, requirement = pic(image_name)
        pdf.write_image_or_placeholder(filename, caption, requirement)

    pdf.write_h2('3.4 每日限定玩法模块')
    pdf.write_body(
        'DailyLimitedScene 提供按日期变化的饮品主题挑战。关卡从 dailyLimitedLevels 配置读取当天目标水果、'
        '饮品名称、配方卡和主题资源，玩家需要在有限暂存空间内完成指定目标。该模式包含洗牌、撤销、抬起等专用道具，'
        '并对开始、结束、分享、额外格子解锁和道具使用进行数据上报。'
    )
    filename, caption, requirement = pic('05_daily_limited.jpg')
    pdf.write_image_or_placeholder(filename, caption, requirement)

    pdf.write_h2('3.5 切水果无尽玩法模块')
    pdf.write_body(
        'FruitSliceEndlessScene 提供分数驱动的无尽挑战玩法。玩家通过水果网格和管道进行合成、清除和刷新，'
        '在管道或网格压力达到上限前尽可能获得更高分数。该模式包含 checkpoint 续玩、复活、里程碑奖励、'
        '金币结算和排行榜上报等机制。'
    )
    filename, caption, requirement = pic('06_fruit_slice.jpg')
    pdf.write_image_or_placeholder(filename, caption, requirement)

    pdf.write_h2('3.6 图鉴、扭蛋与排行榜模块')
    pdf.write_body(
        'CatalogScene 负责展示食材图鉴和解锁状态；GachaScene 负责扭蛋抽奖、奖励发放和库存更新；'
        'LeaderboardScene 负责展示世界榜和好友榜，并与隐私授权、用户资料和开放数据域联动。'
    )
    for image_name in ['07_catalog.jpg', '08_gacha.jpg', '09_leaderboard.jpg']:
        filename, caption, requirement = pic(image_name)
        pdf.write_image_or_placeholder(filename, caption, requirement)

    pdf.write_h2('3.7 云同步与数据上报模块')
    pdf.write_body(
        'CloudSyncManager 负责启动阶段的权威数据拉取、运行中的防抖推送和后台 flush。BackendService 封装鉴权、'
        '存档、排行榜和关卡通关率接口；analytics 模块负责将用户行为事件批量上报到 analytics-ingest 云函数。'
    )
    filename, caption, requirement = pic('10_settings.jpg')
    pdf.write_image_or_placeholder(filename, caption, requirement)

    pdf.write_h1('四、数据结构设计')
    pdf.write_h2('4.1 关卡配置数据结构')
    pdf.write_code_block([
        'interface BowlLevelDef {',
        '  levelNumber: number',
        '  displayName: string',
        '  fruitIds: FruitId[]',
        '  copiesPerFruit: number',
        '  orderTarget: number',
        '  bufferSize: number',
        '  iceCount?: number',
        '  frozenCount?: number',
        '  allowAddDish: boolean',
        '  allowRemove: boolean',
        '  allowShuffle: boolean',
        '}',
    ])
    pdf.write_h2('4.2 水果与订单状态数据结构')
    pdf.write_code_block([
        'FruitItem: fruitId、phase、picked、frozen、bufferSlotIndex、position、velocity',
        'parallelOrders[plateIdx]: { fruitId, progress }',
        'bufferSlots[index]: FruitItem | null',
        'remainingCounts[fruitId]: number',
        'pendingOrderPlateCounts[plateIdx]: number',
    ])
    pdf.write_h2('4.3 玩家进度与经济数据结构')
    pdf.write_code_block([
        'BowlProgress: 当前关卡、已解锁徽章、图鉴解锁状态',
        'Wallet: 金币余额、加减金币记录',
        'ToolInventory: 加菜碟、移除、打乱等道具库存',
        'FruitSliceProgress: 切水果最高分、checkpoint、奖励领取状态',
        'PersistService: 本地 JSON 读写封装',
    ])
    pdf.write_h2('4.4 云端数据结构')
    pdf.write_table_auto(
        ['数据类型', '关键字段', '用途'],
        [
            ['用户存档', 'userId、snapshot、updatedAt', '云端保存玩家进度'],
            ['排行榜记录', 'board、score、rank、profile', '展示关卡进度和无尽分数排名'],
            ['通关率快照', 'level_id、pass_rate、start_users、clear_users', '展示近30天关卡通关数据'],
            ['分析事件', 'event_name、user_id、payload、created_at', '统计玩法行为和转化数据'],
        ],
        col_widths=[32, 58, CONTENT_W - 90],
    )

    pdf.write_h1('五、数据接口设计')
    pdf.write_h2('5.1 本地存储接口')
    pdf.write_body(
        '本地存储由 PlatformService 和 PersistService 统一封装，业务模块使用同步读写接口保存进度、设置、'
        '金币、道具、图鉴和切水果记录。存储失败时使用默认值兜底，不阻塞游戏流程。'
    )
    pdf.write_h2('5.2 云服务接口')
    pdf.write_table_auto(
        ['接口', '功能说明'],
        [
            ['/auth/login', '获取用户身份令牌并绑定平台用户标识'],
            ['/save/pull', '拉取云端权威存档'],
            ['/save/push', '推送本地最新存档快照'],
            ['/rank/submit', '提交排行榜成绩'],
            ['/rank/list', '分页获取排行榜列表'],
            ['/level/pass-rates', '获取近30天关卡通关率快照'],
            ['analytics-ingest', '接收客户端批量行为事件'],
        ],
        col_widths=[42, CONTENT_W - 42],
    )
    pdf.write_h2('5.3 微信平台接口')
    pdf.write_body(
        '本软件使用微信小游戏 Canvas、分包加载、云开发数据库、激励视频广告、分享、开放数据域和隐私授权等能力。'
        '所有平台调用均通过工具层封装，并在不可用或失败时静默降级。'
    )

    pdf.write_h1('六、出错处理设计')
    pdf.write_h2('6.1 网络异常处理')
    for item in [
        '云同步失败时保留本地存档，并在下次启动或后台 flush 时重试',
        '排行榜拉取失败时显示空状态或缓存数据，不影响核心关卡',
        '关卡通关率接口失败时隐藏通关数据卡片或使用本地缓存',
        '广告不可用时根据业务场景提示稍后重试或走不可用降级逻辑',
    ]:
        pdf.write_bullet(item)
    pdf.write_h2('6.2 数据异常处理')
    for item in [
        '配置缺失时使用默认值兜底，防止关卡初始化中断',
        '存档 JSON 解析失败时返回默认结构，避免坏档导致白屏',
        '无效水果 ID 或纹理缺失时跳过绘制，并在控制台记录警告',
        '排行榜用户资料缺失时使用匿名展示，不阻塞成绩提交',
    ]:
        pdf.write_bullet(item)
    pdf.write_h2('6.3 运行时异常处理')
    for item in [
        '场景退出时清理定时器、ticker、原生按钮和临时容器，避免跨场景残留',
        '输入处理在动画、弹窗或教学锁定期间提前返回，避免重复触发',
        '资源加载失败时保留程序绘制兜底 UI，确保主要功能可用',
        '云函数异常由服务层捕获并返回业务可识别错误码',
    ]:
        pdf.write_bullet(item)

    pdf.write_h1('七、性能优化设计')
    pdf.write_h2('7.1 资源管理优化')
    for item in [
        '通过微信分包拆分关卡、主题、徽章、图鉴、每日限定、切水果和扭蛋资源',
        'TextureCache 统一缓存纹理，避免重复创建 Sprite 纹理对象',
        '首页和玩法入口只预加载关键资源，其他资源按场景进入时加载',
        '场景退出时销毁动态创建的 Pixi 容器和文本节点，减少内存泄漏',
    ]:
        pdf.write_bullet(item)
    pdf.write_h2('7.2 渲染性能优化')
    for item in [
        '使用 PixiJS 承担精灵批处理、纹理管理和舞台渲染',
        '将碗内水果、飞行层、汤底层、UI 层分层管理，减少层级错乱和重绘复杂度',
        '高频动画由 Game.ticker 统一驱动，完成后及时 remove',
        '按钮贴图和复杂 UI 采用预制素材，降低运行时矢量绘制成本',
    ]:
        pdf.write_bullet(item)
    pdf.write_h2('7.3 加载与包体优化')
    for item in [
        'Vite 构建输出单一小游戏 bundle，便于微信小游戏加载',
        '图片资源按玩法拆分到 subpackages，降低首包体积',
        'LoadingOverlay 在进入重场景时展示进度，避免用户感知卡顿',
        '音频和广告预热采用后台异步方式执行，不阻塞首屏渲染',
    ]:
        pdf.write_bullet(item)


def write_pic_requirements():
    PICS_DIR.mkdir(parents=True, exist_ok=True)
    target = PICS_DIR / '截图清单.txt'
    lines = [
        '别捞水果软著截图清单',
        '',
        '请按以下文件名放入 JPG/PNG 截图。推荐使用竖屏手机截图，尽量保留完整小游戏画面。',
        '脚本优先读取对应文件名；当前 PDF 中已生成占位框，补图后重新运行 generate_softcopyright_doc_pdf.py 即可替换。',
        '',
    ]
    for filename, caption, requirement in PIC_SPECS:
        lines.append(f'{filename} - {caption}')
        lines.append(f'  {requirement}')
    target.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main():
    write_pic_requirements()
    pdf = DocPDF()
    pdf.add_font('Songti', '', SONGTI_PATH)
    write_document(pdf)
    pdf.output(str(OUTPUT))

    from pypdf import PdfReader
    reader = PdfReader(str(OUTPUT))
    total = len(reader.pages)

    print('=' * 50)
    print('  软著文档鉴别材料(设计说明书) PDF 生成报告')
    print('=' * 50)
    print(f'  软件名称:     {SOFTWARE_FULL_NAME} {SOFTWARE_VERSION}')
    print(f'  申请人:       {APPLICANT_NAME}')
    print(f'  文档类型:     设计说明书')
    print(f'  生成页数:     {total} 页')
    print(f'  输出文件:     {OUTPUT}')
    print(f'  截图目录:     {PICS_DIR}')
    print('=' * 50)
    print('  文档生成完毕')


if __name__ == '__main__':
    main()
