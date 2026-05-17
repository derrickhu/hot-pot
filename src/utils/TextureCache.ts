import * as PIXI from 'pixi.js';

class TextureCacheClass {
  private cache = new Map<string, PIXI.Texture>();
  private failed = new Set<string>();

  get(key: string): PIXI.Texture | null {
    return this.cache.get(key) || null;
  }

  unload(key: string): void {
    const texture = this.cache.get(key);
    if (!texture) {
      this.failed.delete(key);
      return;
    }
    this.cache.delete(key);
    this.failed.delete(key);
    try {
      texture.destroy(true);
    } catch (error) {
      console.warn('[TextureCache] destroy texture failed', key, error);
    }
  }

  unloadMany(keys: Iterable<string>): void {
    for (const key of keys) {
      this.unload(key);
    }
  }

  unloadByPrefix(prefix: string): void {
    const keys = [...this.cache.keys()].filter((key) => key.startsWith(prefix));
    this.unloadMany(keys);
  }

  /** 主图 + 可选变体（同一水果不同切图），变体键为 `${fruitId}__v0` … */
  async loadFruitTextures(
    fruitId: string,
    asset: string,
    variantAssets?: string[] | undefined,
  ): Promise<void> {
    const jobs: Array<Promise<PIXI.Texture | null>> = [this.load(fruitId, asset)];
    if (variantAssets?.length) {
      variantAssets.forEach((src, i) => {
        jobs.push(this.load(`${fruitId}__v${i}`, src));
      });
    }
    await Promise.all(jobs);
  }

  /** 从主图与已加载变体中随机取一张（用于碗内视觉多样性） */
  getRandomForFruit(fruitId: string, variantCount: number): PIXI.Texture | null {
    const n = 1 + Math.max(0, variantCount);
    const i = Math.floor(Math.random() * n);
    const key = i === 0 ? fruitId : `${fruitId}__v${i - 1}`;
    return this.get(key) ?? this.get(fruitId);
  }

  async load(key: string, src: string): Promise<PIXI.Texture | null> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    if (this.failed.has(key)) {
      return null;
    }

    const texture = await this.loadTextureFromSrc(src);

    if (!texture) {
      this.failed.add(key);
      return null;
    }

    this.cache.set(key, texture);
    return texture;
  }

  private loadTextureFromSrc(src: string): Promise<PIXI.Texture | null> {
    const fromImage = (image: HTMLImageElement) =>
      new Promise<PIXI.Texture | null>((resolve) => {
        image.onload = () => {
          try {
            const baseTexture = PIXI.BaseTexture.from(image as PIXI.ImageSource);
            resolve(new PIXI.Texture(baseTexture));
          } catch (error) {
            console.warn('[TextureCache] create texture failed', src, error);
            resolve(null);
          }
        };
        image.onerror = () => resolve(null);
        try {
          image.src = src;
        } catch (error) {
          console.warn('[TextureCache] load failed', src, error);
          resolve(null);
        }
      });

    const api = typeof wx !== 'undefined' ? wx : null;
    if (api && typeof api.createImage === 'function') {
      return fromImage(api.createImage() as HTMLImageElement);
    }

    if (typeof Image === 'function') {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      return fromImage(image);
    }

    return Promise.resolve(null);
  }
}

export const TextureCache = new TextureCacheClass();
