declare const wx: {
  createCanvas: () => HTMLCanvasElement;
  createImage: () => HTMLImageElement;
  getSystemInfoSync?: () => {
    screenWidth: number;
    screenHeight: number;
    pixelRatio?: number;
    statusBarHeight?: number;
    windowWidth?: number;
    windowHeight?: number;
    /** 开发者工具为 `devtools`，真机为 `ios` | `android` 等 */
    platform?: string;
  };
  getMenuButtonBoundingClientRect?: () => { top?: number };
  login?: (options: { success?: (res: { code?: string }) => void; fail?: (err: unknown) => void }) => void;
  getStorageSync: (key: string) => string | null;
  setStorageSync: (key: string, value: string) => void;
  removeStorageSync: (key: string) => void;
  request: (options: Record<string, unknown>) => void;
  onHide?: (handler: () => void) => void;
  onShow?: (handler: () => void) => void;
  offShow?: (handler: () => void) => void;
  onTouchStart: (handler: (event: any) => void) => void;
  onTouchMove: (handler: (event: any) => void) => void;
  onTouchEnd: (handler: (event: any) => void) => void;
  onTouchCancel: (handler: (event: any) => void) => void;
  /** 小游戏分包：https://developers.weixin.qq.com/minigame/dev/api/base/subpackage/wx.loadSubpackage.html */
  loadSubpackage?: (options: {
    name: string;
    success?: () => void;
    fail?: (err: { errMsg?: string } | null) => void;
  }) => { onProgressUpdate?: (cb: (res: { progress: number }) => void) => void };
  createGameClubButton?: (options: {
    type: 'text' | 'image';
    text?: string;
    icon?: 'green' | 'white' | 'dark' | 'light';
    image?: string;
    style: {
      left: number;
      top: number;
      width: number;
      height: number;
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      borderRadius?: number;
      color?: string;
      textAlign?: 'left' | 'center' | 'right';
      fontSize?: number;
      lineHeight?: number;
    };
  }) => {
    style?: Record<string, unknown>;
    show: () => void;
    hide: () => void;
    destroy: () => void;
  };
  getGameClubData?: (options: {
    dataTypeList: Array<{ type: number; subKey?: string }>;
    success?: (res: {
      signature?: string;
      encryptedData?: string;
      iv?: string;
      cloudID?: string;
    }) => void;
    fail?: (err: { errMsg?: string }) => void;
    complete?: (res: unknown) => void;
  }) => void;
  showToast?: (options: { title: string; icon?: string; duration?: number; mask?: boolean }) => void;
  vibrateShort?: (options?: { type?: 'light' | 'medium' | 'heavy'; success?: () => void; fail?: (err: unknown) => void; complete?: () => void }) => void;
  createRewardedVideoAd?: (options: { adUnitId: string }) => {
    load: () => Promise<void>;
    show: () => Promise<void>;
    onClose: (handler: (res?: { isEnded?: boolean }) => void) => void;
    offClose?: (handler: (res?: { isEnded?: boolean }) => void) => void;
    onError: (handler: (err: { errMsg?: string; errCode?: number }) => void) => void;
    offError?: (handler: (err: { errMsg?: string; errCode?: number }) => void) => void;
    destroy?: () => void;
  };
  createInterstitialAd?: (options: { adUnitId: string }) => {
    load: () => Promise<void>;
    show: () => Promise<void>;
    onLoad?: (handler: () => void) => void;
    offLoad?: (handler: () => void) => void;
    onClose: (handler: () => void) => void;
    offClose?: (handler: () => void) => void;
    onError: (handler: (err: { errMsg?: string; errCode?: number }) => void) => void;
    offError?: (handler: (err: { errMsg?: string; errCode?: number }) => void) => void;
    destroy?: () => void;
  };
  shareAppMessage?: (options: {
    title: string;
    imageUrl?: string;
    query?: string;
    success?: () => void;
    fail?: (err: unknown) => void;
    complete?: () => void;
  }) => void;
  showShareMenu?: (options?: {
    withShareTicket?: boolean;
    menus?: Array<'shareAppMessage' | 'shareTimeline'>;
    success?: () => void;
    fail?: (err: unknown) => void;
  }) => void;
  /** 小游戏转发：res.from 为 menu | button 等，见微信文档 */
  onShareAppMessage?: (
    handler: (res?: { from?: string; target?: unknown }) => { title: string; imageUrl?: string; query?: string },
  ) => void;
  /** 小游戏分享到朋友圈：需要 showShareMenu 同时开启 shareTimeline 菜单。 */
  onShareTimeline?: (
    handler: () => { title: string; imageUrl?: string; query?: string },
  ) => void;
  createInnerAudioContext?: () => {
    src: string;
    loop: boolean;
    volume: number;
    autoplay?: boolean;
    obeyMuteSwitch?: boolean;
    play: () => void;
    pause: () => void;
    stop?: () => void;
    destroy?: () => void;
    seek?: (position: number) => void;
    onError?: (handler: (error: unknown) => void) => void;
    onEnded?: (handler: () => void) => void;
  };
  /**
   * 隐私授权接口（基础库 ≥ 2.32.3）。
   * - 已同意：直接 success
   * - 未同意且未注册 onNeedPrivacyAuthorization：弹出微信平台统一隐私授权弹窗
   * - 用户点击同意 → success；点击拒绝 → fail
   */
  requirePrivacyAuthorize?: (options: {
    success?: () => void;
    fail?: (err: { errMsg?: string }) => void;
    complete?: () => void;
  }) => void;
  /**
   * 查询当前隐私授权状态（基础库 ≥ 2.32.3）。
   * res.needAuthorization 为 true 表示尚未同意隐私协议。
   */
  getPrivacySetting?: (options: {
    success?: (res: { needAuthorization: boolean; privacyContractName?: string }) => void;
    fail?: (err: { errMsg?: string }) => void;
    complete?: () => void;
  }) => void;
  /** 打开后台配置的隐私协议合约页面，用户点击"查看详细信息"时调用 */
  openPrivacyContract?: (options?: {
    success?: () => void;
    fail?: (err: { errMsg?: string }) => void;
  }) => void;
  /**
   * 小游戏获取微信用户头像 / 昵称的唯一可靠入口。
   * 必须由"用户主动点击原生按钮"触发才会真正弹出授权框；
   * 主域 JS 调用 wx.getUserInfo / wx.getUserProfile 已基本失效（仅返回"微信用户"占位）。
   */
  createUserInfoButton?: (options: {
    type: 'text' | 'image';
    text?: string;
    image?: string;
    style: {
      left: number;
      top: number;
      width: number;
      height: number;
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      borderRadius?: number;
      color?: string;
      textAlign?: 'left' | 'center' | 'right';
      fontSize?: number;
      lineHeight?: number;
    };
    withCredentials?: boolean;
    lang?: 'en' | 'zh_CN' | 'zh_TW';
  }) => {
    style: Record<string, unknown>;
    show: () => void;
    hide: () => void;
    destroy: () => void;
    onTap: (
      handler: (res?: {
        errMsg?: string;
        err_code?: number;
        userInfo?: {
          nickName: string;
          avatarUrl: string;
          gender?: number;
          country?: string;
          province?: string;
          city?: string;
          language?: string;
        };
      }) => void,
    ) => void;
    offTap?: (handler: (...args: any[]) => void) => void;
  };
  /**
   * 微信小游戏好友榜：把当前用户的分数写入微信托管 KV
   * 详见：https://developers.weixin.qq.com/minigame/dev/api/open-api/data/wx.setUserCloudStorage.html
   */
  setUserCloudStorage?: (options: {
    KVDataList: Array<{ key: string; value: string }>;
    success?: () => void;
    fail?: (err: { errMsg?: string }) => void;
    complete?: () => void;
  }) => void;
  removeUserCloudStorage?: (options: {
    keyList: string[];
    success?: () => void;
    fail?: (err: { errMsg?: string }) => void;
    complete?: () => void;
  }) => void;
  /**
   * 获取开放数据域（子上下文）入口；只在小游戏中存在。
   * canvas 是 sharedCanvas，新基础库中其 width/height 在子域只读，需主域写入。
   * postMessage 用于把渲染参数从主域下发到子域。
   */
  getOpenDataContext?: () => {
    canvas: HTMLCanvasElement & { width: number; height: number };
    postMessage?: (msg: any) => void;
  };
  getSelfOpenId?: () => string;
};

declare const tt: {
  login?: (options: { success?: (res: { code?: string }) => void; fail?: (err: unknown) => void }) => void;
  getStorageSync?: (key: string) => string | null;
  setStorageSync?: (key: string, value: string) => void;
  removeStorageSync?: (key: string) => void;
  request?: (options: Record<string, unknown>) => void;
  onHide?: (handler: () => void) => void;
  getSystemInfoSync?: () => Record<string, unknown>;
};

declare const GameGlobal: Record<string, any>;
