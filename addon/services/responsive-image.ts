import Service from '@ember/service';
import { assert } from '@ember/debug';
import {
  Meta,
  Image,
  ImageMeta,
  ImageType,
} from 'ember-responsive-image/types';

const screenWidth = typeof screen !== 'undefined' ? screen.width : 320;

const extensionTypeMapping = new Map<string, ImageType>([['jpg', 'jpeg']]);

const imageExtensions: Map<ImageType, string> = new Map([['jpeg', 'jpg']]);

/**
 * Service class to provides images generated by the responsive images package
 */
export default class ResponsiveImageService extends Service {
  /**
   * the screen's width
   * This is the base value to calculate the image size.
   * That means the {{#crossLink "Services/ResponsiveImage:getImageBySize"}}getImageBySize{{/crossLink}} will return
   * an image that's close to `screenWidth *  window.devicePixelRatio * size / 100`
   */
  screenWidth = screenWidth;

  /**
   * the physical width
   */
  physicalWidth = this.screenWidth * ((window && window.devicePixelRatio) || 1);

  /**
   * return the images with the different widths
   */
  getImages(imageName: string, type?: ImageType): Image[] {
    imageName = this.normalizeImageName(imageName);
    const meta = this.getMeta(imageName);
    const images: Image[] = [];

    for (const width of meta.widths) {
      if (type) {
        images.push(this.getImageMetaByWidth(imageName, width, type));
      } else {
        for (const type of meta.formats) {
          images.push(this.getImageMetaByWidth(imageName, width, type));
        }
      }
    }

    return images;
  }

  getAvailableWidths(imageName: string): number[] {
    imageName = this.normalizeImageName(imageName);
    return this.getMeta(imageName).widths;
  }

  getMeta(imageName: string): ImageMeta {
    imageName = this.normalizeImageName(imageName);
    assert(
      `There is no data for image ${imageName}`,
      this.meta.images[imageName]
    );

    return this.meta.images[imageName];
  }

  private normalizeImageName(imageName: string): string {
    return imageName.charAt(0) === '/' ? imageName.slice(1) : imageName;
  }

  public getType(imageName: string): ImageType {
    const extension = imageName.split('.').pop();
    assert(`No extension found for ${imageName}`, extension);
    return extensionTypeMapping.get(extension) ?? (extension as ImageType);
  }

  getAvailableTypes(imageName: string): ImageType[] {
    return this.getMeta(imageName).formats;
  }

  /**
   * returns the image data which fits for given size (in vw)
   */
  getImageMetaBySize(
    imageName: string,
    size?: number,
    type: ImageType = this.getType(imageName)
  ): Image | undefined {
    const width = this.getDestinationWidthBySize(size ?? 0);
    return this.getImageMetaByWidth(imageName, width, type);
  }

  /**
   * returns the image data which fits for given width (in px)
   */
  getImageMetaByWidth(
    imageName: string,
    width: number,
    type: ImageType = this.getType(imageName)
  ): Image {
    const imageWidth = this.getMeta(imageName).widths.reduce(
      (prevValue: number, w: number) => {
        if (w >= width && prevValue >= width) {
          return w >= prevValue ? prevValue : w;
        } else {
          return w >= prevValue ? w : prevValue;
        }
      },
      0
    );
    const height = Math.round(imageWidth / this.getAspectRatio(imageName));
    return {
      image: this.getImageFilename(imageName, imageWidth, type),
      width: imageWidth,
      type,
      height,
    };
  }

  getAspectRatio(imageName: string): number {
    return this.getMeta(imageName).aspectRatio;
  }

  getImageFilename(image: string, width: number, format: ImageType): string {
    image = this.normalizeImageName(image);
    // this must match `generateFilename()` of ImageWriter broccoli plugin!
    const ext = imageExtensions.get(format) ?? format;
    const base = image.substr(0, image.lastIndexOf('.'));
    const fingerprint = this.getMeta(image).fingerprint;
    return `/${base}${width}w${fingerprint ? '-' + fingerprint : ''}.${ext}`;
  }

  /**
   *
   * @param size
   * @private
   */
  public getDestinationWidthBySize(size: number): number {
    const physicalWidth = this.physicalWidth;
    const factor = (size || 100) / 100;

    return physicalWidth * factor;
  }

  private _meta?: Meta;

  /**
   * the meta values from build time
   */
  get meta(): Meta {
    if (this._meta) {
      return this._meta;
    }
    const script = document.getElementById('ember_responsive_image_meta');
    assert(
      'No script tag found containing meta data for ember-responsive-image',
      script?.textContent
    );
    const meta = JSON.parse(script.textContent);
    // eslint-disable-next-line ember/no-side-effects
    this._meta = meta;
    return meta;
  }
  set meta(meta: Meta) {
    this._meta = meta;
  }
}
