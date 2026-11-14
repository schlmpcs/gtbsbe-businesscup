'use client';

import { afford as t, pro } from '@/copy';
import { Button, Card, LockNotice, Money, Row, Stack } from '@/ui-kit';
import { useState } from 'react';
import type { AffordVM, Purchase } from '../model/types';

function howOften(p: Purchase): string {
  return p.recurring === false ? t.wishlist.recurring.once : t.wishlist.recurring[p.recurring];
}

function payWithText(p: Purchase): string {
  return t.wishlist.payWith[typeof p.payWith === 'object' ? 'loan' : p.payWith];
}

export type WishlistProps = Pick<
  AffordVM,
  'wishlist' | 'addToWishlist' | 'removeFromWishlist' | 'loadFromWishlist' | 'wishlistLocked' | 'proHref'
> & {
  /** The form describes a valid purchase that can be saved. */
  canAdd: boolean;
};

/**
 * Saved purchases (kept on this device): check one again or remove it. Saving a new one is a Pro
 * feature, so a free user gets a notice that links to the paywall instead of a save button.
 */
export function Wishlist({
  wishlist,
  addToWishlist,
  removeFromWishlist,
  loadFromWishlist,
  wishlistLocked,
  proHref,
  canAdd,
}: WishlistProps) {
  const [justAdded, setJustAdded] = useState(false);
  return (
    <Card
      title={t.wishlist.title}
      action={
        wishlistLocked ? undefined : (
          <Button
            size="sm"
            variant="secondary"
            disabled={!canAdd}
            onClick={() => setJustAdded(addToWishlist() !== null)}
          >
            {t.wishlist.add}
          </Button>
        )
      }
    >
      <Stack gap="sm">
        {wishlistLocked ? (
          <LockNotice title={pro.lock.title} body={pro.lock.wishlistBody} ctaLabel={pro.lock.cta} href={proHref} />
        ) : null}
        <p aria-live="polite" className="text-xs text-text-muted">
          {justAdded ? t.wishlist.added : ''}
        </p>
        {wishlist.length === 0 ? (
          <p className="text-sm text-text-muted">{t.wishlist.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {wishlist.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-sm py-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{item.purchase.label}</span>
                  <span className="text-sm text-text-muted">
                    <Money value={item.purchase.amount} /> {howOften(item.purchase)} · {payWithText(item.purchase)}
                  </span>
                </div>
                <Row gap="xs">
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={t.wishlist.loadLabel(item.purchase.label)}
                    onClick={() => {
                      setJustAdded(false);
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
      </Stack>
    </Card>
  );
}
