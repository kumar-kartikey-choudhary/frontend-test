import { Component, computed, inject, signal } from '@angular/core';
import { Pager } from '../../../shared/components/pager/pager';
import { Paginator } from '../../../shared/uti/paginator';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService } from '../../service/admin-service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import type { UserDto } from '../../../model/user.model';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.html',
  styleUrls: ['./user-management.css'],
  standalone: true,
  imports: [FormsModule, Pager],
})
export class UserManagement {
  private adminService = inject(AdminService);
  private router = inject(Router);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);

  /** Ids with a delete in flight, so a double click can't send it twice. */
  readonly deleting = signal<ReadonlySet<string>>(new Set());

  users = signal<UserDto[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);
  query = signal('');
  /** Paging over the filtered list. */
  protected readonly pg = new Paginator(() => this.filteredUsers());


  filteredUsers = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.users();
    return this.users().filter((u) =>
      [u.username, u.firstName, u.lastName, u.email, u.role]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  });

  constructor() {
    this.loadAllUsers();
  }

  loadAllUsers(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.users.set([]);

    this.adminService.getAllUsers().subscribe({
      next: (data: UserDto[]) => {
        this.users.set(data.filter((user) => user.role !== 'ADMIN'));
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Could not load users.');
        this.isLoading.set(false);
      },
    });
  }

  /** Deletes a customer's account: their details are erased and they can no longer sign in; their orders stay on record. */
  async deleteUser(user: UserDto): Promise<void> {
    if (this.deleting().has(user.id)) return;
    const ok = await this.confirm.confirm({
      title: `Delete ${user.username}?`,
      message:
        `${user.firstName} ${user.lastName}'s name, contact details, saved addresses and notifications are erased and they can no longer ` +
        'sign in. Their past orders and payments stay on record, and the username stays reserved. This cannot be undone.',
      confirmText: 'Delete account',
      cancelText: 'Keep account',
      tone: 'danger',
    });
    if (!ok) return;

    this.deleting.update((s) => new Set(s).add(user.id));
    this.adminService.deleteUser(user.id).subscribe({
      next: () => {
        this.users.update((list) => list.filter((u) => u.id !== user.id));
        this.toast.success(`${user.username}'s account was deleted.`);
        this.finishDelete(user);
      },
      error: () => this.finishDelete(user),
    });
  }

  private finishDelete(user: UserDto): void {
    this.deleting.update((s) => {
      const next = new Set(s);
      next.delete(user.id);
      return next;
    });
  }

  /** "ROLE_ADMIN" -> "admin" */
  roleLabel(role: string): string {
    return (role ?? '').replace(/^ROLE_/i, '').toLowerCase();
  }

  getInitials(username: string): string {
    return username?.trim().charAt(0).toUpperCase() || '?';
  }

  /** Opens the Orders page already filtered to this customer. */
  viewHistory(user: UserDto): void {
    this.router.navigate(['/admin/orders'], { queryParams: { q: user.username } });
  }
}