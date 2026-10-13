import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { PLACEHOLDER_IMAGE } from '../uti/image.util';

/**
 * Swaps a broken <img> for the placeholder. Guarded so a missing placeholder can't loop forever.
 */
@Directive({ selector: 'img[appImgFallback]', standalone: true })
export class ImgFallbackDirective {
  private readonly img = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;

  @HostListener('error')
  onError(): void {
    if (!this.img.src.endsWith(PLACEHOLDER_IMAGE)) {
      this.img.src = PLACEHOLDER_IMAGE;
    }
  }
}
