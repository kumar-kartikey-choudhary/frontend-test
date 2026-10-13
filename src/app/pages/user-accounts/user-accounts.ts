import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AddressService } from '../../service/address/address-service';
import { AuthService } from '../../service/login/auth-service';
import { NotificationService } from '../../service/notification/notification-service';
import { PaymentService } from '../../service/payment/payment-service';
import { UserService } from '../../service/user/user-service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { safeReturnUrl } from '../../shared/uti/safe-url.util';
import type { UserDto } from '../../model';
import type { AddressDto } from '../../model/address.model';
import type { NotificationDto } from '../../model/notification';
import type { SavedPaymentMethodDto } from '../../model/payment';

type AccountTab = 'profile' | 'security' | 'addresses' | 'cards' | 'notifications';

const TABS: AccountTab[] = ['profile', 'security', 'addresses', 'cards', 'notifications'];

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
  imports: [FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserAccounts implements OnInit {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly addressService = inject(AddressService);
  private readonly notificationService = inject(NotificationService);
  private readonly paymentService = inject(PaymentService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly tabs: { id: AccountTab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Password' },
    { id: 'addresses', label: 'Addresses' },
    { id: 'cards', label: 'Saved cards' },
    { id: 'notifications', label: 'Notifications' },
  ];
  protected readonly activeTab = signal<AccountTab>('profile');

  /** Set when the customer came here to add an address mid-checkout: we send them back after saving. */
  protected readonly returnUrl = signal<string | null>(null);

  // ---- Profile ----
  protected readonly profile = signal<UserDto | null>(null);
  protected readonly profileLoading = signal(true);
  protected readonly profileError = signal('');
  protected readonly editing = signal(false);
  protected readonly savingProfile = signal(false);
  protected editData: Partial<UserDto> = {};

  // ---- Addresses ----
  protected readonly addresses = signal<AddressDto[]>([]);
  protected readonly addressesLoading = signal(false);
  protected readonly addressFormOpen = signal(false);
  protected readonly savingAddress = signal(false);
  protected currentAddress: Partial<AddressDto> = { ...EMPTY_ADDRESS };
  private addressesLoaded = false;

  // ---- Saved cards ----
  protected readonly cards = signal<SavedPaymentMethodDto[]>([]);
  protected readonly cardsLoading = signal(false);
  private cardsLoaded = false;

  // ---- Notifications ----
  protected readonly notifications = signal<NotificationDto[]>([]);
  protected readonly notificationsLoading = signal(false);
  protected readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length);
  private notificationsLoaded = false;

  constructor() {
    // The header's bell links here with ?tab=notifications; checkout links with ?tab=addresses.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const tab = params.get('tab') as AccountTab | null;
      this.returnUrl.set(safeReturnUrl(params.get('returnUrl')));
      if (tab && TABS.includes(tab)) {
        this.selectTab(tab);
      }
    });
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  protected selectTab(tab: AccountTab): void {
    this.activeTab.set(tab);
    if (tab === 'addresses' && !this.addressesLoaded) this.loadAddresses();
    if (tab === 'cards' && !this.cardsLoaded) this.loadCards();
    if (tab === 'notifications' && !this.notificationsLoaded) this.loadNotifications();
  }

  // ==================== Profile ====================

  protected loadProfile(): void {
    this.profileLoading.set(true);
    this.profileError.set('');
    this.userService.me().subscribe({
      next: (user) => {
        this.profile.set(user);
        this.editData = { ...user };
        this.profileLoading.set(false);
      },
      error: () => {
        this.profileError.set("We couldn't load your profile.");
        this.profileLoading.set(false);
      },
    });
  }

  protected startEdit(): void {
    this.editData = { ...this.profile() };
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    this.editData = { ...this.profile() };
  }

  protected saveProfile(form: NgForm): void {
    const profile = this.profile();
    if (!profile?.id || this.savingProfile()) return;
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    this.savingProfile.set(true);
    this.userService.update(profile.id, this.editData).subscribe({
      next: () => {
        this.toast.success('Profile updated.');
        this.editing.set(false);
        this.savingProfile.set(false);
        this.loadProfile();
      },
      error: (err) => {
        this.toast.error(err?.error?.message || "We couldn't update your profile. Please try again.");
        this.savingProfile.set(false);
      },
    });
  }

  // ==================== Email verification ====================

  protected readonly resendingVerification = signal(false);

  protected resendVerification(): void {
    if (this.resendingVerification()) return;
    this.resendingVerification.set(true);
    this.userService.resendVerification().subscribe({
      next: () => {
        this.toast.success('We sent a confirmation link to your email address.');
        this.resendingVerification.set(false);
      },
      error: () => this.resendingVerification.set(false),
    });
  }

  // ==================== Delete account ====================

  protected readonly deleteFormOpen = signal(false);
  protected readonly deletingAccount = signal(false);
  protected deletePassword = '';

  protected async deleteAccount(): Promise<void> {
    if (this.deletingAccount() || !this.deletePassword) return;
    const ok = await this.confirm.confirm({
      title: 'Delete your account for good?',
      message:
        'Your name, contact details, saved addresses and notifications will be erased and you will be signed out everywhere. ' +
        'Your past orders stay on record with the shop. This cannot be undone.',
      confirmText: 'Delete my account',
      cancelText: 'Keep my account',
      tone: 'danger',
    });
    if (!ok) return;

    this.deletingAccount.set(true);
    this.authService.deleteAccount(this.deletePassword).subscribe({
      next: () => {
        this.deletingAccount.set(false);
        this.toast.success('Your account has been deleted.');
        this.router.navigate(['/']);
      },
      // A wrong password etc. is reported by the global error interceptor with the server's message.
      error: () => this.deletingAccount.set(false),
    });
  }

  // ==================== Password ====================

  protected readonly MIN_PASSWORD_LENGTH = 8;
  protected readonly changingPassword = signal(false);
  protected readonly showPasswords = signal(false);
  protected passwords = { current: '', next: '', confirm: '' };

  protected get passwordsDontMatch(): boolean {
    return !!this.passwords.confirm && this.passwords.next !== this.passwords.confirm;
  }

  protected get newPasswordSameAsCurrent(): boolean {
    return !!this.passwords.next && this.passwords.next === this.passwords.current;
  }

  protected changePassword(form: NgForm): void {
    if (this.changingPassword()) return;
    if (form.invalid || this.passwordsDontMatch || this.newPasswordSameAsCurrent) {
      form.control.markAllAsTouched();
      return;
    }

    this.changingPassword.set(true);
    this.authService.changePassword(this.passwords.current, this.passwords.next).subscribe({
      next: () => {
        this.toast.success('Password changed. Any other devices have been signed out.');
        this.passwords = { current: '', next: '', confirm: '' };
        form.resetForm(this.passwords);
        this.changingPassword.set(false);
      },
      // A wrong current password etc. is reported by the global error interceptor with the server's message.
      error: () => this.changingPassword.set(false),
    });
  }

  // ==================== Addresses ====================

  protected loadAddresses(): void {
    this.addressesLoading.set(true);
    this.addressService.getAll().subscribe({
      next: (data) => {
        this.addresses.set(data);
        this.addressesLoaded = true;
        this.addressesLoading.set(false);
      },
      error: () => this.addressesLoading.set(false),
    });
  }

  protected addNewAddress(): void {
    this.currentAddress = { ...EMPTY_ADDRESS };
    this.addressFormOpen.set(true);
  }

  protected editAddress(address: AddressDto): void {
    this.currentAddress = { ...address };
    this.addressFormOpen.set(true);
  }

  protected cancelAddressEdit(): void {
    this.addressFormOpen.set(false);
  }

  protected saveAddress(form: NgForm): void {
    if (this.savingAddress()) return;
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    this.savingAddress.set(true);
    const isNew = !this.currentAddress.id;
    const save$ = isNew
      ? this.addressService.create(this.currentAddress)
      : this.addressService.update(this.currentAddress.id!, this.currentAddress);

    save$.subscribe({
      next: () => {
        this.savingAddress.set(false);
        this.addressFormOpen.set(false);
        this.toast.success(isNew ? 'Address added.' : 'Address updated.');
        const back = this.returnUrl();
        if (back) {
          // They came from checkout to add an address - take them straight back.
          this.router.navigateByUrl(back);
        } else {
          this.loadAddresses();
        }
      },
      error: (err) => {
        this.toast.error(err?.error?.message || "We couldn't save this address. Please try again.");
        this.savingAddress.set(false);
      },
    });
  }

  protected markAddressDefault(address: AddressDto): void {
    if (address.isDefault) return;
    this.addressService.markDefault(address.id).subscribe({
      next: () => {
        this.toast.success(`"${address.label}" is now your default address.`);
        this.loadAddresses();
      },
    });
  }

  protected async removeAddress(address: AddressDto): Promise<void> {
    const ok = await this.confirm.confirm({
      title: `Delete "${address.label}"?`,
      message: 'This address will be removed from your account. Past orders are not affected.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.addressService.delete(address.id).subscribe({
      next: () => {
        this.toast.success('Address deleted.');
        this.loadAddresses();
      },
    });
  }

  // ==================== Saved cards ====================

  protected loadCards(): void {
    this.cardsLoading.set(true);
    this.paymentService.getSavedMethods().subscribe({
      next: (data) => {
        this.cards.set(data);
        this.cardsLoaded = true;
        this.cardsLoading.set(false);
      },
      error: () => this.cardsLoading.set(false),
    });
  }

  protected async removeCard(card: SavedPaymentMethodDto): Promise<void> {
    const ok = await this.confirm.confirm({
      title: `Remove the card ending ${card.cardLastFour}?`,
      message: 'You can save it again the next time you pay by card.',
      confirmText: 'Remove card',
      tone: 'danger',
    });
    if (!ok) return;
    this.paymentService.deleteSavedMethod(card.id).subscribe({
      next: () => {
        this.toast.success('Card removed.');
        this.loadCards();
      },
    });
  }

  protected expiryOf(card: SavedPaymentMethodDto): string {
    const month = String(card.cardExpiryMonth ?? '').padStart(2, '0');
    const year = String(card.cardExpiryYear ?? '').slice(-2);
    return month && year ? `${month}/${year}` : '';
  }

  // ==================== Notifications ====================

  protected loadNotifications(): void {
    this.notificationsLoading.set(true);
    this.notificationService.getAll().subscribe({
      next: (data) => {
        this.notifications.set(data);
        this.notificationsLoaded = true;
        this.notificationsLoading.set(false);
      },
      error: () => this.notificationsLoading.set(false),
    });
  }

  protected markNotificationRead(notification: NotificationDto): void {
    if (notification.read) return;
    this.notificationService.markRead(notification.id).subscribe({
      next: () =>
        this.notifications.update((list) =>
          list.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
        ),
    });
  }

  protected markAllNotificationsRead(): void {
    this.notificationService.markAllRead().subscribe({
      next: () => this.notifications.update((list) => list.map((n) => ({ ...n, read: true }))),
    });
  }

  protected removeNotification(notification: NotificationDto): void {
    this.notificationService.delete(notification.id).subscribe({
      next: () => {
        this.notifications.update((list) => list.filter((n) => n.id !== notification.id));
        // The header badge counts unread ones, so refresh it if we just deleted an unread one.
        if (!notification.read) this.notificationService.refreshUnreadCount();
      },
    });
  }

  protected notificationIconFor(type: string): string {
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
