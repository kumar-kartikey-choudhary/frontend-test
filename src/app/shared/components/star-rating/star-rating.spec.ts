import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StarRating } from './star-rating';

describe('StarRating', () => {
  let fixture: ComponentFixture<StarRating>;
  const el = () => fixture.nativeElement as HTMLElement;

  function render(value: number, count: number | null = null): void {
    fixture = TestBed.createComponent(StarRating);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('count', count);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [StarRating] }));

  it('fills the gold stars to the average (4.3 of 5 is 86%)', () => {
    render(4.3);
    expect((el().querySelector('.fill') as HTMLElement).style.width).toBe('86%');
  });

  it('describes itself for screen readers, with the number of reviews when known', () => {
    render(4, 1);
    expect(el().querySelector('[role=img]')!.getAttribute('aria-label')).toBe('4 out of 5 stars from 1 review');
    render(4.5, 12);
    expect(el().querySelector('[role=img]')!.getAttribute('aria-label')).toBe('4.5 out of 5 stars from 12 reviews');
    expect(el().textContent).toContain('(12)');
  });

  it('shows no count when none is given and never overfills', () => {
    render(7);
    expect(el().querySelector('.count')).toBeNull();
    expect((el().querySelector('.fill') as HTMLElement).style.width).toBe('100%');
  });
});
