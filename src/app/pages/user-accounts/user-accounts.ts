import { environment } from '../../../environments/environment';
import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../service/login/auth-service';
import { AddressService } from '../../service/address/address-service';
import { NotificationService } from '../../service/notification/notification-service';
import type { UserDto } from '../../model';
import type { AddressDto } from '../../model/address.model';
import type { NotificationDto } from '../../model/notification';

type AccountTab = 'profile' | 'addresses' | 'notifications';

const EMPTY_ADDRESS: Partial<AddressDto> = {
  label: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  landmark: '',
  isDefault: false,
};

@Component({
  selector: 'app-user-account',
  templateUrl: './user-accounts.html',
  styleUrls: ['./user-accounts.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
})
export class UserAccounts implements OnInit {
  activeTab: AccountTab = 'profile';

  // ---- Profile ----
  profile: UserDto | null = null;
  isLoading = true;
  errorMsg = '';
  successMsg = '';
  isEditing = false;
  editData: Partial<UserDto> = {};

  // ---- Addresses ----
  addresses: AddressDto[] = [];
  isLoadingAddresses = false;
  isEditingAddress = false;
  isSavingAddress = false;
  currentAddress: Partial<AddressDto> = { ...EMPTY_ADDRESS };

  // ---- Notifications ----
  notifications: NotificationDto[] = [];
  isLoadingNotifications = false;

  private userUrl = `${environment.apiBaseUrl}/users`;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private addressService: AddressService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  selectTab(tab: AccountTab): void {
    this.activeTab = tab;
    if (tab === 'addresses' && this.addresses.length === 0) {
      this.loadAddresses();
    }
    if (tab === 'notifications' && this.notifications.length === 0) {
      this.loadNotifications();
    }
  }

  // ==================== Profile ====================

  loadProfile(): void {
    this.http.get<UserDto>(`${this.userUrl}/me`).subscribe({
      next: (user) => {
        this.profile = user;
        this.editData = { ...user };
        this.isLoading = false;
      },
      error: () => {
        this.errorMsg = 'Profile load nahi ho saka.';
        this.isLoading = false;
      },
    });
  }

  saveProfile(): void {
    if (!this.profile?.id) return;
    this.http.patch(`${this.userUrl}/update/${this.profile.id}`, this.editData).subscribe({
      next: () => {
        this.successMsg = 'Profile update ho gaya!';
        this.isEditing = false;
        this.loadProfile();
      },
      error: () => {
        this.errorMsg = 'Profile update nahi ho saka.';
      },
    });
  }

  startEdit(): void {
    this.editData = { ...this.profile };
    this.isEditing = true;
    this.successMsg = '';
    this.errorMsg = '';
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.editData = { ...this.profile };
  }

  // ==================== Addresses ====================

  loadAddresses(): void {
    this.isLoadingAddresses = true;
    this.addressService.getAll().subscribe({
      next: (data) => {
        this.addresses = data;
        this.isLoadingAddresses = false;
      },
      error: () => {
        this.isLoadingAddresses = false;
      },
    });
  }

  addNewAddress(): void {
    this.currentAddress = { ...EMPTY_ADDRESS };
    this.isEditingAddress = true;
  }

  editAddress(address: AddressDto): void {
    this.currentAddress = { ...address };
    this.isEditingAddress = true;
  }

  cancelAddressEdit(): void {
    this.isEditingAddress = false;
  }

  saveAddress(): void {
    if (
      !this.currentAddress.label ||
      !this.currentAddress.line1 ||
      !this.currentAddress.city ||
      !this.currentAddress.state ||
      !this.currentAddress.pincode
    ) {
      alert('Label, address line 1, city, state and pincode are required.');
      return;
    }

    this.isSavingAddress = true;
    const save$ = this.currentAddress.id
      ? this.addressService.update(this.currentAddress.id, this.currentAddress)
      : this.addressService.create(this.currentAddress);

    save$.subscribe({
      next: () => {
        this.isSavingAddress = false;
        this.isEditingAddress = false;
        this.loadAddresses();
      },
      error: (err) => {
        console.error('Failed to save address:', err);
        alert('Could not save this address. Please try again.');
        this.isSavingAddress = false;
      },
    });
  }

  markAddressDefault(address: AddressDto): void {
    if (address.isDefault) return;
    this.addressService.markDefault(address.id).subscribe({
      next: () => this.loadAddresses(),
      error: () => alert('Could not set this address as default.'),
    });
  }

  removeAddress(address: AddressDto): void {
    if (!confirm(`Delete the "${address.label}" address?`)) return;
    this.addressService.delete(address.id).subscribe({
      next: () => this.loadAddresses(),
      error: () => alert('Could not delete this address.'),
    });
  }

  // ==================== Notifications ====================

  loadNotifications(): void {
    this.isLoadingNotifications = true;
    this.notificationService.getAll().subscribe({
      next: (data) => {
        this.notifications = data;
        this.isLoadingNotifications = false;
      },
      error: () => {
        this.isLoadingNotifications = false;
      },
    });
  }

  get unreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  markNotificationRead(notification: NotificationDto): void {
    if (notification.read) return;
    this.notificationService.markRead(notification.id).subscribe({
      next: () => (notification.read = true),
      error: () => {},
    });
  }

  markAllNotificationsRead(): void {
    this.notificationService.markAllRead().subscribe({
      next: () => this.notifications.forEach((n) => (n.read = true)),
      error: () => {},
    });
  }

  removeNotification(notification: NotificationDto): void {
    this.notificationService.delete(notification.id).subscribe({
      next: () => (this.notifications = this.notifications.filter((n) => n.id !== notification.id)),
      error: () => {},
    });
  }

  notificationIconFor(type: string): string {
    switch (type) {
      case 'ORDER_UPDATE':
        return '📦';
      case 'PAYMENT_UPDATE':
        return '💳';
      case 'DELIVERY_REMINDER':
        return '🚚';
      case 'PROMOTION':
        return '🎉';
      default:
        return '🔔';
    }
  }
}