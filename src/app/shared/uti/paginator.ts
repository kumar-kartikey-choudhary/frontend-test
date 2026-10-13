import { computed, signal } from '@angular/core';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * Client-side paging over a list that is already filtered. Give it the list (a signal read) and bind
 * `items()` in the template; pair it with <app-pager>. The page number is clamped, so filtering the
 * list down to fewer pages never leaves the view on a page that no longer exists.
 */
export class Paginator<T> {
  readonly page = signal(1);
  readonly pageSize = signal<number>(PAGE_SIZE_OPTIONS[0]);

  readonly total = computed(() => this.source().length);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  /** The page actually shown (1-based), never past the last page. */
  readonly current = computed(() => Math.min(Math.max(1, this.page()), this.pageCount()));
  readonly items = computed(() => {
    const start = (this.current() - 1) * this.pageSize();
    return this.source().slice(start, start + this.pageSize());
  });

  constructor(private readonly source: () => readonly T[]) {}

  goTo(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.pageCount()));
  }

  setSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  /** Back to the first page - call when the search or a filter changes. */
  reset(): void {
    this.page.set(1);
  }
}
