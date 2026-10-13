import { signal } from '@angular/core';
import { Paginator } from './paginator';

describe('Paginator', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  it('shows the first page of ten by default', () => {
    const list = signal(rows(23));
    const pg = new Paginator(() => list());
    expect(pg.items()).toEqual(rows(10));
    expect(pg.total()).toBe(23);
    expect(pg.pageCount()).toBe(3);
  });

  it('moves between pages and never goes past the ends', () => {
    const pg = new Paginator(() => rows(23));
    pg.goTo(3);
    expect(pg.items()).toEqual([21, 22, 23]);
    pg.goTo(99);
    expect(pg.current()).toBe(3);
    pg.goTo(-4);
    expect(pg.current()).toBe(1);
  });

  it('goes back to page one when the page size changes', () => {
    const pg = new Paginator(() => rows(60));
    pg.goTo(3);
    pg.setSize(25);
    expect(pg.current()).toBe(1);
    expect(pg.items().length).toBe(25);
  });

  it('stays on a page that exists when filtering leaves fewer rows', () => {
    const list = signal(rows(35));
    const pg = new Paginator(() => list());
    pg.goTo(4);
    expect(pg.items()).toEqual([31, 32, 33, 34, 35]);

    list.set(rows(12)); // now only 2 pages
    expect(pg.current()).toBe(2);
    expect(pg.items()).toEqual([11, 12]);
  });

  it('copes with an empty list', () => {
    const pg = new Paginator(() => []);
    expect(pg.items()).toEqual([]);
    expect(pg.pageCount()).toBe(1);
    expect(pg.current()).toBe(1);
  });

  it('reset() returns to the first page', () => {
    const pg = new Paginator(() => rows(40));
    pg.goTo(3);
    pg.reset();
    expect(pg.current()).toBe(1);
  });
});
