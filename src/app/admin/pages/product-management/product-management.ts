import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProductService } from '../../../service/product/product-service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { Pager } from '../../../shared/components/pager/pager';
import { PLACEHOLDER_IMAGE } from '../../../shared/uti/image.util';
import { categoryLabel } from '../../../shared/uti/category.util';
import type { InventoryLedgerEntry, InventoryReason, Product } from '../../../model';

/** Stock at or below this many units is flagged in the table (matches the dashboard's threshold). */
const LOW_STOCK_THRESHOLD = 10;

const PAGE_SIZES = [10, 25, 50, 100];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const STOCK_REASONS: { value: InventoryReason; label: string }[] = [
  { value: 'RESTOCK', label: 'Restock (new stock arrived)' },
  { value: 'SPOILAGE', label: 'Spoilage / write-off' },
  { value: 'ADJUSTMENT', label: 'Correction after a count' },
  { value: 'RETURN', label: 'Customer return' },
];

type ProductForm = Partial<Product> & { images?: Product['images'] };

@Component({
  selector: 'app-product-management',
  templateUrl: './product-management.html',
  styleUrls: ['./product-management.css'],
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe, ImgFallbackDirective, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductManagement implements OnInit {
  private readonly service = inject(ProductService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  // Backend enum: Dairy | Sweets | Bakery | Snacks | Cold_Drinks
  protected readonly categories = ['All', 'Dairy', 'Sweets', 'Bakery', 'Snacks', 'Cold_Drinks'];
  protected readonly types = ['Kaju', 'Barfee', 'Peda', 'Dry_Fruit', 'Laddoo', 'Chenna', 'Gulab_Jamun', 'Jalebi'];
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly stockReasons = STOCK_REASONS;
  protected readonly lowStock = LOW_STOCK_THRESHOLD;
  protected readonly label = categoryLabel;

  // ------------------------------------------------------------------ list
  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly searchTerm = signal('');
  protected readonly selectedCategory = signal('All');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(PAGE_SIZES[0]);

  protected readonly filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const category = this.selectedCategory();
    return this.products().filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        (!term || p.productName.toLowerCase().includes(term) || p.id.toLowerCase().includes(term)),
    );
  });
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize())));
  /** The page actually shown - never past the last page after a search shrinks the list. */
  protected readonly currentPage = computed(() => Math.min(this.page(), this.pageCount()));
  protected readonly pageItems = computed(() => {
    const start = (Math.min(this.page(), this.pageCount()) - 1) * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  // ------------------------------------------------------------- selection
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly allOnPageSelected = computed(
    () => this.pageItems().length > 0 && this.pageItems().every((p) => this.selected().has(p.id)),
  );

  // ----------------------------------------------------------- add / edit
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected current: ProductForm = this.emptyProduct();
  protected readonly pendingImage = signal<{ file: File; previewUrl: string } | null>(null);

  // --------------------------------------------------------- stock dialogs
  /** null = closed; a product = adjusting that one; 'bulk' = adjusting every selected product. */
  protected readonly adjusting = signal<Product | 'bulk' | null>(null);
  protected adjust = { changeQty: null as number | null, reason: 'RESTOCK' as InventoryReason };
  protected readonly adjustingSaving = signal(false);
  protected readonly ledger = signal<InventoryLedgerEntry[]>([]);
  protected readonly ledgerLoading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.service.getAllProducts(true).subscribe({
      next: (data) => {
        this.products.set(data);
        this.loading.set(false);
        // Drop selections for products that no longer exist.
        const ids = new Set(data.map((p) => p.id));
        this.selected.update((s) => new Set([...s].filter((id) => ids.has(id))));
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  // ---------------------------------------------------------------- list UI

  protected setSearch(value: string): void {
    this.searchTerm.set(value);
    this.page.set(1);
  }

  protected setCategory(value: string): void {
    this.selectedCategory.set(value);
    this.page.set(1);
  }

  protected setPageSize(value: string | number): void {
    this.pageSize.set(Number(value));
    this.page.set(1);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.pageCount()));
  }

  protected imageUrl(imageId: string): string {
    return this.service.imageUrl(imageId);
  }

  protected thumbOf(product: Product): string {
    const image = product.images?.find((i) => i.primary) ?? product.images?.[0];
    return image ? this.service.imageUrl(image.id) : PLACEHOLDER_IMAGE;
  }

  protected statusClass(product: Product): string {
    switch ((product.status ?? '').toLowerCase()) {
      case 'in stock':
        return 'adm-badge--success';
      case 'low stock':
        return 'adm-badge--warning';
      case 'out of stock':
        return 'adm-badge--danger';
      default:
        return ''; // Discontinued and anything unknown: neutral
    }
  }

  protected isLow(product: Product): boolean {
    return product.stockQuantity <= LOW_STOCK_THRESHOLD;
  }

  // -------------------------------------------------------------- selection

  protected toggleOne(product: Product): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (next.has(product.id)) next.delete(product.id);
      else next.add(product.id);
      return next;
    });
  }

  protected togglePage(): void {
    const all = this.allOnPageSelected();
    this.selected.update((s) => {
      const next = new Set(s);
      this.pageItems().forEach((p) => (all ? next.delete(p.id) : next.add(p.id)));
      return next;
    });
  }

  protected clearSelection(): void {
    this.selected.set(new Set());
  }

  // ------------------------------------------------------------- add / edit

  private emptyProduct(): ProductForm {
    return {
      id: '',
      productName: '',
      price: 0,
      available: true,
      stockQuantity: 0,
      stockUnit: 'kg',
      category: 'Dairy',
      type: '',
      description: '',
      manufactureDate: new Date().toISOString().substring(0, 10),
      expiryDate: '',
      status: 'In Stock',
    };
  }

  protected addNew(): void {
    this.current = this.emptyProduct();
    this.clearPendingImage();
    this.formOpen.set(true);
  }

  protected edit(product: Product): void {
    this.current = { ...product };
    this.clearPendingImage();
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.clearPendingImage();
    this.formOpen.set(false);
  }

  protected onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.clearPendingImage();
    if (!file) return;
    // An allow-list rather than "image/*": SVG and other types can carry scripts and are not accepted.
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.toast.error('Please choose a JPG, PNG, WebP or GIF picture.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.toast.error(`That picture is too large. The limit is ${MAX_IMAGE_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    this.pendingImage.set({ file, previewUrl: URL.createObjectURL(file) });
  }

  private clearPendingImage(): void {
    const pending = this.pendingImage();
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    this.pendingImage.set(null);
  }

  protected save(form: NgForm): void {
    if (this.saving()) return;
    if (form.invalid) {
      form.control.markAllAsTouched();
      this.toast.error('Please fix the highlighted fields.');
      return;
    }
    if (!this.current.price || this.current.price <= 0) {
      this.toast.error('Price must be greater than 0.');
      return;
    }

    const isNew = !this.current.id;
    const payload: Partial<Product> = { ...this.current };
    // Images are managed through their own endpoints, never through the product body.
    delete payload.images;

    this.saving.set(true);
    const save$ = isNew
      ? this.service.addProduct(payload)
      : this.service.updateProduct(this.current.id!, payload);

    save$.subscribe({
      next: (saved) => this.afterSave(saved),
      error: () => this.saving.set(false), // the interceptor shows the server's message
    });
  }

  private afterSave(saved: Product): void {
    // The photo is uploaded after the product exists (images are keyed by product id). A failed
    // upload shouldn't undo the product save that already succeeded, so it's reported separately.
    const pending = this.pendingImage();
    if (!pending) {
      this.finishSave(saved);
      return;
    }
    this.service.addImage(saved.id, pending.file, true).subscribe({
      next: () => this.finishSave(saved),
      error: () => {
        this.toast.error(`'${saved.productName}' was saved, but its photo failed to upload.`);
        this.finishSave(saved, false);
      },
    });
  }

  private finishSave(saved: Product, announce = true): void {
    if (announce) this.toast.success(`'${saved.productName}' saved.`);
    this.saving.set(false);
    this.closeForm();
    this.load();
  }

  protected async removeImage(imageId: string): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Remove this photo?',
      confirmText: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    this.service.deleteImage(imageId).subscribe({
      next: () => {
        this.current = { ...this.current, images: (this.current.images ?? []).filter((i) => i.id !== imageId) };
        this.toast.success('Photo removed.');
        this.load();
      },
    });
  }

  // ----------------------------------------------------------------- delete

  protected async remove(product: Product): Promise<void> {
    const ok = await this.confirm.confirm({
      title: `Delete "${product.productName}"?`,
      message:
        'It disappears from the shop immediately. Customers who already ordered it keep their order history. ' +
        'If you only want to stop selling it, set "Available for sale" to No instead.',
      confirmText: 'Delete product',
      tone: 'danger',
    });
    if (!ok) return;
    this.service.deleteProduct(product.id).subscribe({
      next: () => {
        this.toast.success(`'${product.productName}' deleted.`);
        this.selected.update((s) => {
          const next = new Set(s);
          next.delete(product.id);
          return next;
        });
        this.load();
      },
    });
  }

  // ------------------------------------------------------------ stock adjust

  protected openAdjust(target: Product | 'bulk'): void {
    if (target === 'bulk' && this.selected().size === 0) return;
    this.adjust = { changeQty: null, reason: 'RESTOCK' };
    this.ledger.set([]);
    this.adjusting.set(target);

    if (target !== 'bulk') {
      this.ledgerLoading.set(true);
      this.service.getLedger(target.id).subscribe({
        next: (entries) => {
          this.ledger.set(entries.slice(0, 8));
          this.ledgerLoading.set(false);
        },
        error: () => this.ledgerLoading.set(false),
      });
    }
  }

  protected closeAdjust(): void {
    this.adjusting.set(null);
  }

  protected adjustTitle(): string {
    const target = this.adjusting();
    if (target === 'bulk') return `Adjust stock for ${this.selected().size} selected products`;
    return target ? `Adjust stock - ${target.productName}` : '';
  }

  protected applyAdjust(form: NgForm): void {
    const target = this.adjusting();
    const change = this.adjust.changeQty;
    if (!target || this.adjustingSaving()) return;
    if (form.invalid || change === null || change === 0) {
      form.control.markAllAsTouched();
      this.toast.error('Enter a quantity other than 0 (use a minus sign to remove stock).');
      return;
    }

    const products = target === 'bulk' ? this.products().filter((p) => this.selected().has(p.id)) : [target];
    this.adjustingSaving.set(true);

    // One failing product (e.g. it would go below zero) shouldn't hide the result for the others.
    forkJoin(
      products.map((p) =>
        this.service.adjustStock(p.id, change, this.adjust.reason).pipe(
          catchError((err) => of({ error: err?.error?.message || 'failed', name: p.productName })),
        ),
      ),
    ).subscribe((results) => {
      const failures = results.filter((r): r is { error: string; name: string } => 'error' in r);
      const ok = results.length - failures.length;
      this.adjustingSaving.set(false);
      if (ok) this.toast.success(`Stock updated for ${ok} product${ok === 1 ? '' : 's'}.`);
      failures.forEach((f) => this.toast.error(`${f.name}: ${f.error}`));
      if (!failures.length) {
        this.closeAdjust();
        if (target === 'bulk') this.clearSelection();
      }
      this.load();
    });
  }
}
