import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideAppTesting } from '../../../../testing';
import { AuthService } from '../../../service/login/auth-service';
import { WishlistService } from '../../../service/wishlist/wishlist-service';
import { ToastService } from '../../../core/services/toast.service';
import { WishlistButton } from './wishlist-button';

describe('WishlistButton', () => {
  let fixture: ComponentFixture<WishlistButton>;
  let wishlist: WishlistService;
  let auth: AuthService;
  let router: Router;
  let toast: ToastService;
  const button = () => fixture.nativeElement.querySelector('button.heart') as HTMLButtonElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [WishlistButton], providers: provideAppTesting() });
    wishlist = TestBed.inject(WishlistService);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    toast = TestBed.inject(ToastService);
    spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(toast, 'info');
    fixture = TestBed.createComponent(WishlistButton);
    fixture.componentRef.setInput('productId', 'p1');
    fixture.detectChanges();
  });

  it('sends a signed-out visitor to log in instead of saving', () => {
    spyOn(auth, 'isLoggedIn').and.returnValue(false);
    const toggle = spyOn(wishlist, 'toggle');

    button().click();

    expect(toggle).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], jasmine.objectContaining({ queryParams: jasmine.objectContaining({ returnUrl: jasmine.any(String) }) }));
  });

  it('saves for a signed-in customer and reflects it in aria-pressed and the label', () => {
    spyOn(auth, 'isLoggedIn').and.returnValue(true);
    spyOn(wishlist, 'isSaved').and.returnValue(false);
    const toggle = spyOn(wishlist, 'toggle');
    expect(button().getAttribute('aria-pressed')).toBe('false');
    expect(button().getAttribute('aria-label')).toBe('Save to wishlist');

    button().click();
    expect(toggle).toHaveBeenCalledWith('p1');
  });

  it('shows a saved product as pressed', () => {
    spyOn(wishlist, 'isSaved').and.returnValue(true);
    fixture = TestBed.createComponent(WishlistButton);
    fixture.componentRef.setInput('productId', 'p1');
    fixture.detectChanges();

    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(button().getAttribute('aria-label')).toBe('Remove from wishlist');
    expect(button().classList).toContain('heart--saved');
  });

  it('does not let the click reach a link around it', () => {
    spyOn(auth, 'isLoggedIn').and.returnValue(true);
    spyOn(wishlist, 'toggle');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    button().dispatchEvent(event);

    expect(event.defaultPrevented).toBeTrue();
  });
});
