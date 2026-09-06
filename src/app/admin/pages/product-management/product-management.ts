import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ProductService } from '../../../service/product/product-service';
import type { Product } from '../../../model';

/**
 * Empty-string id is the "this is a new, unsaved product" sentinel.
 * Backend ids are UUID strings (BaseDto.id), generated server-side on
 * create - they are never `0`, so `0` can't be used as a sentinel here
 * the way the previous `number`-typed model did.
 */
const NEW_PRODUCT_ID = '';

@Component({
  selector: 'app-product-management',
  templateUrl: './product-management.html',
  styleUrls: ['./product-management.css'],
  standalone: true,
  imports: [FormsModule, DecimalPipe],
})
export class ProductManagement implements OnInit {
  // State variables
  isEditing = false;
  allProducts: Product[] = [];
  currentProduct: any = this.getEmptyProductModel();
  // Backend enum: Dairy | Sweets | Bakery | Snacks | Cold_Drinks
  categories = ['All', 'Dairy', 'Sweets', 'Bakery', 'Snacks', 'Cold_Drinks'];

  // File handling and loading
  selectedFile: File | null = null;
  isUploading = false;

  // Sweet-type dropdown only shown when the selected category is "Sweets".
  types = ['Kaju', 'Barfee', 'Peda', 'Dry_Fruit', 'Laddoo', 'Chenna', 'Gulab_Jamun', 'Jalebi'];

  searchTerm = '';
  selectedCategory = 'All';

  constructor(private service: ProductService) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  private getEmptyProductModel(): any {
    return {
      id: NEW_PRODUCT_ID,
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

  /**
   * Method to initiate adding a new product.
   */
  addNewProducts(): void {
    this.currentProduct = this.getEmptyProductModel();
    this.selectedFile = null;
    this.isEditing = true;
  }

  /**
   * Method to initiate editing a product (used by the HTML button).
   */
  editProduct(product: Product): void {
    this.currentProduct = { ...product };
    this.selectedFile = null;
    this.isEditing = true;
  }

  saveProduct(): void {
    if (this.isUploading) return;

    if (!this.currentProduct.category) {
      alert('Please select a category.');
      return;
    }
    if (!this.currentProduct.price || this.currentProduct.price <= 0) {
      alert('Price must be greater than 0.');
      return;
    }

    const productPayload: Partial<Product> = { ...this.currentProduct };
    this.isUploading = true;
    const isNew = !productPayload.id;

    const save$ = isNew
      ? this.service.addProduct(productPayload)
      : this.service.updateProduct(this.currentProduct.id, productPayload);

    save$.subscribe({
      next: (saved) => this.afterSave(saved),
      error: (err) => {
        console.error(isNew ? 'Add product failed:' : 'Update failed:', err);
        alert((isNew ? 'Add' : 'Update') + ' failed. Check API connection.');
        this.isUploading = false;
      },
    });
  }

  private afterSave(saved: Product): void {
    // Image upload happens after the product exists, since ProductImage rows are keyed off a
    // real product id. A failed image upload shouldn't undo the product save that already
    // succeeded, so it's reported separately rather than rolled back.
    if (this.selectedFile) {
      this.service.addImage(saved.id, this.selectedFile, true).subscribe({
        next: () => this.finishSave(saved.productName),
        error: (err) => {
          console.error('Image upload failed:', err);
          alert(`Product '${saved.productName}' saved, but the image failed to upload.`);
          this.finishSave(saved.productName);
        },
      });
    } else {
      this.finishSave(saved.productName);
    }
  }

  private finishSave(productName: string): void {
    alert(`Product '${productName}' saved successfully!`);
    this.isEditing = false;
    this.isUploading = false;
    this.selectedFile = null;
    this.loadProducts();
  }

  /**
   * Getter for filtered products (uses searchTerm and selectedCategory).
   */
  get filteredProducts(): Product[] {
    let products = this.allProducts;
    const term = this.searchTerm.toLowerCase();

    if (this.selectedCategory !== 'All') {
      products = products.filter((p) => p.category === this.selectedCategory);
    }
    if (term) {
      products = products.filter((p) => p.productName.toLowerCase().includes(term));
    }
    return products;
  }

  /**
   * Loads product data from the backend API.
   */
  loadProducts(): void {
    this.service.getAllProducts(true).subscribe({
      next: (data) => (this.allProducts = data),
      error: (err) => console.error('Failed to fetch products', err),
    });
  }
}