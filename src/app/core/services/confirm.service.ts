import { Injectable, signal } from '@angular/core';

export interface DialogOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** "danger" styles the confirm button red - use for deletes, refunds, cancellations. */
  tone?: 'default' | 'danger';
  /** When set, the dialog shows a text field and resolves with what was typed. */
  input?: {
    label: string;
    placeholder?: string;
    required?: boolean;
    initialValue?: string;
  };
}

export interface ActiveDialog {
  options: DialogOptions;
  /** Resolves with: true/false for confirm(); the typed text or null for prompt(). */
  resolve: (value: boolean | string | null) => void;
}

/**
 * Replacement for window.confirm() / window.prompt(): accessible, styled, and awaitable.
 * The dialog itself is rendered once by <app-confirm-dialog> in the app shell.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly active = signal<ActiveDialog | null>(null);

  /** Resolves true if the user confirmed, false if they cancelled or dismissed. */
  confirm(options: Omit<DialogOptions, 'input'>): Promise<boolean> {
    return this.open(options) as Promise<boolean>;
  }

  /** Resolves with the entered text (possibly empty), or null if the user cancelled. */
  prompt(options: DialogOptions & { input: NonNullable<DialogOptions['input']> }): Promise<string | null> {
    return this.open(options) as Promise<string | null>;
  }

  private open(options: DialogOptions): Promise<boolean | string | null> {
    // Only one dialog at a time: a second request cancels the first.
    this.active()?.resolve(options.input ? null : false);
    return new Promise((resolve) => {
      this.active.set({
        options,
        resolve: (value) => {
          this.active.set(null);
          resolve(value);
        },
      });
    });
  }
}
