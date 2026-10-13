import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminHeader } from './admin-header';

import { provideAppTesting } from '../../../../testing';
describe('AdminHeader', () => {
  let component: AdminHeader;
  let fixture: ComponentFixture<AdminHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: provideAppTesting(),
      imports: [AdminHeader],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminHeader);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
