import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { mailtoHref, telHref } from '../../../shared/uti/safe-url.util';
import { Pager } from '../../../shared/components/pager/pager';
import { Paginator } from '../../../shared/uti/paginator';
import { DatePipe } from '@angular/common';
import { ContactService } from '../../../service/contact/contact-service';
import type { ContactMessageDto } from '../../../model';

/** Messages customers sent through the website's contact form. */
@Component({
  selector: 'app-message-management',
  standalone: true,
  imports: [DatePipe, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './message-management.html',
  styleUrls: ['../user-management/user-management.css', './message-management.css'],
})
export class MessageManagement implements OnInit {
  private readonly contactService = inject(ContactService);

  protected readonly messages = signal<ContactMessageDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly showHandled = signal(false);
  /** Paging over the visible messages. */
  protected readonly pg = new Paginator(() => this.visible());
  protected readonly busy = signal<ReadonlySet<string>>(new Set());

  protected readonly visible = computed(() =>
    this.showHandled() ? this.messages() : this.messages().filter((m) => !m.handled),
  );
  protected readonly openCount = computed(() => this.messages().filter((m) => !m.handled).length);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.contactService.findAll().subscribe({
      next: (messages) => {
        this.messages.set(messages);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  protected toggleHandled(message: ContactMessageDto): void {
    if (this.busy().has(message.id)) return;
    this.busy.update((s) => new Set(s).add(message.id));
    this.contactService.markHandled(message.id, !message.handled).subscribe({
      next: (updated) => {
        this.messages.update((list) => list.map((m) => (m.id === updated.id ? updated : m)));
        this.release(message.id);
      },
      error: () => this.release(message.id),
    });
  }

  private release(id: string): void {
    this.busy.update((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  protected replyLink(message: ContactMessageDto): string {
    return mailtoHref(message.email, 'Re: your message to Pratik Dairy & Sweets');
  }

  protected callHref(message: ContactMessageDto): string {
    return telHref(message.phone);
  }

  protected mailHref(message: ContactMessageDto): string {
    return mailtoHref(message.email);
  }
}
