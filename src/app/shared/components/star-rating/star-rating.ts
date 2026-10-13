import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Read-only stars: five grey stars with gold ones laid over them, cut off at the average (so 4.3 shows 4 and a bit). */
@Component({
  selector: 'app-star-rating',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="stars" role="img" [attr.aria-label]="label()">
      <span class="base" aria-hidden="true">★★★★★</span>
      <span class="fill" aria-hidden="true" [style.width.%]="percent()">★★★★★</span>
    </span>
    @if (count() !== null) {
      <span class="count">({{ count() }})</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.95rem;
      line-height: 1;
    }
    .stars {
      position: relative;
      display: inline-block;
      letter-spacing: 0.08em;
    }
    .base {
      color: rgb(255 255 255 / 25%);
    }
    .fill {
      position: absolute;
      inset: 0 auto 0 0;
      overflow: hidden;
      white-space: nowrap;
      color: var(--pd-amber, #ffc107);
    }
    .count {
      font-size: 0.8rem;
      color: var(--pd-text-muted, #a0a0a0);
    }
  `,
})
export class StarRating {
  /** Average, 0 to 5. */
  readonly value = input(0);
  /** Number of reviews; null hides the count. */
  readonly count = input<number | null>(null);

  protected readonly percent = computed(() => Math.max(0, Math.min(100, (this.value() / 5) * 100)));
  protected readonly label = computed(() => {
    const count = this.count();
    const base = `${this.value()} out of 5 stars`;
    return count === null ? base : `${base} from ${count} ${count === 1 ? 'review' : 'reviews'}`;
  });
}
