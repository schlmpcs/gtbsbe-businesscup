'use client';

import { afford as t, pro } from '@/copy';
import { Button, LockNotice, Money, Row, Sticker } from '@/ui-kit';
import type { AffordVM, PayWithChoice, Purchase } from '../model/types';

function howOften(p: Purchase): string {
  return p.recurring === false ? t.wishlist.recurring.once : t.wishlist.recurring[p.recurring];
}

function payWithText(p: Purchase): string {
  return t.wishlist.payWith[typeof p.payWith === 'object' ? 'loan' : p.payWith];
}

export type WishlistActionsProps = Pick<AffordVM, 'addToWishlist' | 'wishlistLocked' | 'proHref' | 'setPayWith'> & {
  /** The form describes a valid purchase that can be saved. */
  canAdd: boolean;
  /** The last save worked (shown in a live region). */
  justAdded: boolean;
  onAdded: (ok: boolean) => void;
  /** Set when a ready verdict says another way to pay is cheaper: the ghost action switches to it. */
  cheaperWay: PayWithChoice | null;
};

/**
 * The actions under the answer (Figma S11): primary "Save to wishlist" with the ink Pro pill, and a ghost
 * action that tries the cheapest way to pay. Saving is a Pro feature, so a free user gets a notice that
 * links to the paywall instead of the save button.
 */
export function WishlistActions({
  addToWishlist,
  wishlistLocked,
  proHref,
  setPayWith,
  canAdd,
  justAdded,
  onAdded,
  cheaperWay,
}: WishlistActionsProps) {
  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap items-center gap-lg">
        {wishlistLocked ? null : (
          <>
            <Button size="lg" disabled={!canAdd} onClick={() => onAdded(addToWishlist() !== null)}>
              {t.wishlist.add}
            </Button>
            <Sticker tone="ink" className="normal-case">
              {t.wishlist.proPill}
            </Sticker>
          </>
        )}
        {cheaperWay && (
          <Button variant="ghost" onClick={() => setPayWith(cheaperWay)}>
            {t.result.tryCheapest[cheaperWay]}
          </Button>
        )}
        <p aria-live="polite" className="text-sm font-semibold text-positive">
          {justAdded ? t.wishlist.added : ''}
        </p>
      </div>
      {wishlistLocked ? (
        <LockNotice
          title={pro.lock.title}
          body={pro.lock.wishlistBody}
          ctaLabel={pro.lock.cta}
          href={proHref}
          className="max-w-(--container-xl) shadow-md"
        />
      ) : null}
    </div>
  );
}

export type WishlistProps = Pick<AffordVM, 'wishlist' | 'removeFromWishlist' | 'loadFromWishlist'> & {
  /** Called when a saved purchase is put back in the form (clears the "saved" message). */
  onLoad: () => void;
};

/** "Your wishlist": saved purchases (kept on this device) as a row of white cards; check one again or remove it. */
export function Wishlist({ wishlist, removeFromWishlist, loadFromWishlist, onLoad }: WishlistProps) {
  return (
    <section aria-label={t.wishlist.title} className="flex flex-col gap-lg">
      <div className="flex flex-wrap items-baseline gap-x-lg gap-y-xs">
        <h2 className="font-display text-4xl font-extrabold leading-tight">{t.wishlist.title}</h2>
        <p className="text-lg text-text-muted">{t.wishlist.count(wishlist.length)}</p>
      </div>
      {wishlist.length > 0 && (
        <ul className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
          {wishlist.map((item) => (
            <li key={item.id} className="flex min-w-0 flex-col justify-between gap-md rounded-xl bg-surface p-xl shadow-md">
              <div className="flex min-w-0 flex-col items-start gap-xs">
                <span className="w-full truncate text-lg font-bold">{item.purchase.label}</span>
                <Money value={item.purchase.amount} className="font-display text-4xl font-extrabold leading-tight" />
                <span className="rounded-full bg-primary-soft px-md py-xs text-sm font-semibold text-primary">
                  {howOften(item.purchase)} · {payWithText(item.purchase)}
                </span>
              </div>
              <Row gap="xs">
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={t.wishlist.loadLabel(item.purchase.label)}
                  onClick={() => {
                    onLoad();
                    loadFromWishlist(item.id);
                  }}
                >
                  {t.wishlist.load}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t.wishlist.removeLabel(item.purchase.label)}
                  onClick={() => removeFromWishlist(item.id)}
                >
                  {t.wishlist.remove}
                </Button>
              </Row>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
