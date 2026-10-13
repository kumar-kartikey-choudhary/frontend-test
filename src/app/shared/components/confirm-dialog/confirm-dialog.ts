import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmService } from '../../../core/services/confirm.service';
import { StorageService } from '../../../core/services/storage.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialog {
  protected readonly dialogs = inject(ConfirmService);
  private readonly storage = inject(StorageService);

  protected readonly text = signal('');
  protected readonly touched = signal(false);

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    effect(() => {
      const active = this.dialogs.active();
      if (!active || !this.storage.isBrowser) return;
      this.text.set(active.options.input?.initialValue ?? '');
      this.touched.set(false);
      // Wait for the panel to render, then move keyboard focus into it.
      setTimeout(() => {
        const el = this.panel()?.nativeElement;
        const target =
          el?.querySelector<HTMLElement>('input, textarea') ??
          el?.querySelector<HTMLElement>('.btn--confirm');
        target?.focus();
      });
    });
  }

  protected get invalid(): boolean {
    const input = this.dialogs.active()?.options.input;
    return !!input?.required && !this.text().trim();
  }

  protected confirm(): void {
    const active = this.dialogs.active();
    if (!active) return;
    if (this.invalid) {
      this.touched.set(true);
      return;
    }
    active.resolve(active.options.input ? this.text().trim() : true);
  }

  protected cancel(): void {
    const active = this.dialogs.active();
    active?.resolve(active.options.input ? null : false);
  }

  /** Keeps Tab inside the dialog while it is open. */
  protected trapFocus(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      this.panel()?.nativeElement.querySelectorAll<HTMLElement>('button, input, textarea') ?? [],
    ).filter((el) => !el.hasAttribute('disabled'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
