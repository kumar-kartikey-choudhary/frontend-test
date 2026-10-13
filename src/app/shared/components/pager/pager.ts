import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PAGE_SIZE_OPTIONS } from '../../uti/paginator';

/** "Rows [10]  Showing 11-20 of 47  Previous / Next" - the paging bar under every admin list. */
@Component({
  selector: 'app-pager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pager.html',
  styleUrl: './pager.css',
})
export class Pager {
  readonly total = input.required<number>();
  /** 1-based page currently shown. */
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly pageSizes = input<readonly number[]>(PAGE_SIZE_OPTIONS);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly from = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1));
  protected readonly to = computed(() => Math.min(this.total(), this.page() * this.pageSize()));

  protected onSize(event: Event): void {
    this.pageSizeChange.emit(Number((event.target as HTMLSelectElement).value));
  }
}
