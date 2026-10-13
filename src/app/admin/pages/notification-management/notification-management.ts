import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { NotificationAdminService } from '../../service/notification-admin-service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import type { AdminNotificationRequest } from '../../../model';

type Audience = AdminNotificationRequest['audience'];
type NotificationKind = AdminNotificationRequest['type'];

/** Lets the admin send an announcement or a personal message to customers' notification bells. */
@Component({
  selector: 'app-notification-management',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-management.html',
  styleUrls: ['../user-management/user-management.css', './notification-management.css'],
})
export class NotificationManagement {
  private readonly service = inject(NotificationAdminService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly kinds: { value: NotificationKind; label: string }[] = [
    { value: 'PROMOTION', label: 'Offer / promotion' },
    { value: 'SYSTEM', label: 'General announcement' },
    { value: 'DELIVERY_REMINDER', label: 'Delivery reminder' },
  ];

  protected audience: Audience = 'ALL_CUSTOMERS';
  protected username = '';
  protected kind: NotificationKind = 'PROMOTION';
  protected title = '';
  protected message = '';

  protected readonly sending = signal(false);
  protected readonly lastSent = signal<number | null>(null);

  protected async send(form: NgForm): Promise<void> {
    if (form.invalid || this.sending()) {
      form.control.markAllAsTouched();
      return;
    }
    const everyone = this.audience === 'ALL_CUSTOMERS';
    const ok = await this.confirm.confirm({
      title: everyone ? 'Send to every customer?' : `Send to ${this.username.trim()}?`,
      message: `"${this.title.trim()}" will appear in ${everyone ? "all customers'" : 'their'} notifications straight away. It can't be taken back.`,
      confirmText: 'Send',
      cancelText: 'Not yet',
    });
    if (!ok) return;

    this.sending.set(true);
    this.service
      .send({
        audience: this.audience,
        username: everyone ? undefined : this.username.trim(),
        type: this.kind,
        title: this.title.trim(),
        message: this.message.trim() || undefined,
      })
      .subscribe({
        next: ({ sent }) => {
          this.sending.set(false);
          this.lastSent.set(sent);
          this.toast.success(`Sent to ${sent} ${sent === 1 ? 'customer' : 'customers'}.`);
          this.title = '';
          this.message = '';
          form.resetForm({ audience: this.audience, username: this.username, kind: this.kind, title: '', message: '' });
        },
        error: () => this.sending.set(false),
      });
  }
}
