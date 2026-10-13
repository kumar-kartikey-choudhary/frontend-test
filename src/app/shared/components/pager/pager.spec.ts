import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pager } from './pager';

describe('Pager', () => {
  let fixture: ComponentFixture<Pager>;
  const el = () => fixture.nativeElement as HTMLElement;
  const buttons = () => Array.from(el().querySelectorAll<HTMLButtonElement>('.pg-btn'));

  function render(total: number, page: number, pageSize = 10): void {
    fixture = TestBed.createComponent(Pager);
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('pageSize', pageSize);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [Pager] }));

  it('says which rows are on show', () => {
    render(47, 2);
    expect(el().textContent).toContain('Showing 11–20 of 47');
    expect(el().textContent).toContain('Page 2 of 5');
  });

  it('shows the short last page correctly', () => {
    render(47, 5);
    expect(el().textContent).toContain('Showing 41–47 of 47');
  });

  it('disables Previous on the first page and Next on the last', () => {
    render(25, 1);
    expect(buttons()[0].disabled).toBeTrue();
    expect(buttons()[1].disabled).toBeFalse();

    render(25, 3);
    expect(buttons()[0].disabled).toBeFalse();
    expect(buttons()[1].disabled).toBeTrue();
  });

  it('asks for the neighbouring page', () => {
    render(47, 2);
    const asked: number[] = [];
    fixture.componentInstance.pageChange.subscribe((p) => asked.push(p));
    buttons()[1].click();
    buttons()[0].click();
    expect(asked).toEqual([3, 1]);
  });

  it('reports a new page size', () => {
    render(47, 1);
    let size = 0;
    fixture.componentInstance.pageSizeChange.subscribe((n) => (size = n));
    const select = el().querySelector<HTMLSelectElement>('select.size')!;
    select.value = '25';
    select.dispatchEvent(new Event('change'));
    expect(size).toBe(25);
  });

  it('shows nothing when there are no rows', () => {
    render(0, 1);
    expect(el().querySelector('.pager')).toBeNull();
  });
});
