// src/app/pages/contact/contact.component.ts

import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ContactService } from '../../service/contact/contact-service';
import { ToastService } from '../../core/services/toast.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.html',
  styleUrls: ['./contact.css'],
  standalone: true,
  imports: [FormsModule],
})
export class Contact {
  private readonly contactService = inject(ContactService);
  private readonly toast = inject(ToastService);

  inquiry = { name: '', email: '', phone: '', message: '' };

  storeInfo = {
    addressLine1: 'Dindayal Chouk, rampayli road waraseroni',
    city: 'Waraseroni, India - 481331',
    phone: '+91 7000628291',
    email: 'info@pratikdairysweets.com',
    hours: 'Mon - Sat: 7:00 AM - 10:00 PM',

    // Raw URL used for sanitization (Use the actual embed link from Google Maps)
    rawMapUrl: 'https://maps.google.com/maps?q=Pratik+Dairy+and+Sweets+Waraseoni&output=embed',
  };

  // Public property to hold the sanitized URL
  safeMapUrl: SafeResourceUrl;

  // 1. Inject the DomSanitizer service
  constructor(private sanitizer: DomSanitizer) {
    // 2. Mark the URL as safe for use in an iframe's src attribute
    this.safeMapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.storeInfo.rawMapUrl);
  }

  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Sends the message to the shop; it appears on the admin Messages page (and in the shop's inbox when email is set up). */
  submit(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }
    if (this.submitting()) return;

    this.submitting.set(true);
    this.errorMessage.set(null);
    const { name, email, phone, message } = this.inquiry;
    this.contactService
      .send({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, message: message.trim() })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.sent.set(true);
          this.toast.success("Thanks - we've received your message and will get back to you soon.");
          this.inquiry = { name: '', email: '', phone: '', message: '' };
          form.resetForm(this.inquiry);
        },
        error: (error) => {
          this.submitting.set(false);
          this.errorMessage.set(
            error?.status === 429
              ? error.error?.message
              : "We couldn't send your message right now. Please try again, or call us.",
          );
        },
      });
  }

  /** Back to the form after a message was sent, to write another. */
  writeAnother(): void {
    this.sent.set(false);
  }
}
