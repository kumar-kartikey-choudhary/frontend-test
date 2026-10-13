import { TestBed } from '@angular/core/testing';
import { App } from './app';

import { provideAppTesting } from '../testing';
describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: provideAppTesting(),
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the page shell: skip link, main landmark and the dialog/toast hosts', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('a.skip-link')?.getAttribute('href')).toBe('#main-content');
    expect(root.querySelector('main#main-content')).toBeTruthy();
    expect(root.querySelector('app-toast-host')).toBeTruthy();
    expect(root.querySelector('app-confirm-dialog')).toBeTruthy();
  });
});
