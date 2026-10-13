import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { HttpTestingController } from '@angular/common/http/testing';

import { Login } from './login';

import { provideAppTesting } from '../../../testing';
describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: provideAppTesting(),
      imports: [Login],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links to the forgot-password page', () => {
    const link = (fixture.nativeElement as HTMLElement).querySelector('a.forgot-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/forgot-password');
  });
});

describe('Login after a password reset', () => {
  it('tells the customer to sign in with the new password', async () => {
    await TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ passwordReset: 'true' }) } } },
      ],
      imports: [Login],
    }).compileComponents();

    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Your password has been changed');
  });
});

describe('Login lockout', () => {
  it('shows the server\'s lockout message instead of "invalid password"', async () => {
    await TestBed.configureTestingModule({ providers: provideAppTesting(), imports: [Login] }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    await fixture.whenStable();

    const set = (id: string, value: string) => {
      const input = fixture.nativeElement.querySelector('#' + id) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    set('username', 'asha');
    set('password', 'wrong-password');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));

    http.expectOne((r) => r.url.endsWith('/users/login')).flush(
      { message: 'Too many failed sign-in attempts. Please try again in 15 minutes, or reset your password.' },
      { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Too many failed sign-in attempts');
    expect(text).not.toContain('Invalid username or password');
  });
});
