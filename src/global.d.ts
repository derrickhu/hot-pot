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
  };
  getMenuButtonBoundingClientRect?: () => { top?: number };
  getStorageSync: (key: string) => string | null;
  setStorageSync: (key: string, value: string) => void;
  removeStorageSync: (key: string) => void;
  request: (options: Record<string, unknown>) => void;
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
  showToast?: (options: { title: string; icon?: string }) => void;
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
};

declare const GameGlobal: Record<string, any>;
