import type { ReactNode } from 'react';

type PurchaseState = ReturnType<typeof import('./useProPurchase').useProPurchase>;
type Props = { disabledForQA?: boolean; render: (purchase: PurchaseState) => ReactNode };

// Only the native DEBUG launch adapter can set this opt-in property. Separate
// component types keep React hooks unconditional; the real SDK is lazily loaded.
export function PurchaseBoundary({ disabledForQA, render }: Props) {
  return disabledForQA === true ? <IsolatedPurchase render={render} /> : <ConnectedPurchase render={render} />;
}
function ConnectedPurchase({ render }: Pick<Props, 'render'>) {
  const { useProPurchase } = require('./useProPurchase') as typeof import('./useProPurchase');
  const purchase = useProPurchase();
  return render(purchase);
}
const isolated: PurchaseState = {
  isPro: false, connected: false, price: undefined, message: null,
  buy: async () => {}, restore: async () => {},
};
function IsolatedPurchase({ render }: Pick<Props, 'render'>) { return render(isolated); }
