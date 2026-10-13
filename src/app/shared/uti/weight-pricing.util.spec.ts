import { defaultWeightFor, isWeightBased, priceForWeight } from './weight-pricing.util';

describe('weight pricing helpers', () => {
  it('recognises weight-sold units but not counted ones', () => {
    ['kg', 'g', 'gms', '500g', '1 kg', '0.5kg', 'KG'].forEach((u) => expect(isWeightBased(u)).withContext(u).toBeTrue());
    ['pcs', 'box', 'litre', '', null, undefined].forEach((u) => expect(isWeightBased(u)).withContext(String(u)).toBeFalse());
  });

  it('scales the price by pack size relative to the product unit', () => {
    expect(priceForWeight(400, '250g', 'kg')).toBe(100);
    expect(priceForWeight(400, '500g', 'kg')).toBe(200);
    expect(priceForWeight(400, '1kg', 'kg')).toBe(400);
  });

  it('charges the listed price for counted units at the default pack size', () => {
    const weight = defaultWeightFor('pcs');
    expect(priceForWeight(40, weight, 'pcs')).toBe(40);
  });

  it('defaults to the product own unit when it is a selectable pack size', () => {
    expect(defaultWeightFor('500g')).toBe('500g');
    expect(defaultWeightFor('kg')).toBe('1kg');
  });
});
