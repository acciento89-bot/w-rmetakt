import { useEffect, useMemo, useState } from 'react';
import { ErrorCode, useIAP } from 'react-native-iap';
import { database } from './database';

export const PRO_PRODUCT_ID = 'de.kamilunavo.waermetakt.pro';

export function useProPurchase() {
  const [isPro, setIsPro] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const iap = useIAP({
    onPurchaseSuccess: async (purchase) => {
      if (purchase.productId !== PRO_PRODUCT_ID) return;
      await database.setState('pro_entitlement', 'true');
      setIsPro(true);
      await iap.finishTransaction({ purchase, isConsumable: false });
    },
    onPurchaseError: (error) => {
      if (error.code !== ErrorCode.UserCancelled) setMessage(error.message);
    },
    onError: (error) => setMessage(error.message),
  });

  useEffect(() => { database.initialize().then(() => database.getState('pro_entitlement')).then((value) => setIsPro(value === 'true')); }, []);
  useEffect(() => { if (iap.connected) void iap.fetchProducts({ skus: [PRO_PRODUCT_ID], type: 'in-app' }); }, [iap.connected]);
  useEffect(() => {
    if (iap.availablePurchases.some((purchase) => purchase.productId === PRO_PRODUCT_ID)) {
      void database.setState('pro_entitlement', 'true');
      setIsPro(true);
      setMessage(null);
    }
  }, [iap.availablePurchases]);

  const product = useMemo(() => iap.products.find((item) => item.id === PRO_PRODUCT_ID), [iap.products]);
  const buy = async () => { setMessage(null); await iap.requestPurchase({ request: { apple: { sku: PRO_PRODUCT_ID }, google: { skus: [PRO_PRODUCT_ID] } }, type: 'in-app' }); };
  const restore = async () => { setMessage(null); await iap.restorePurchases(); };
  return { isPro, connected: iap.connected, price: product?.displayPrice, message, buy, restore };
}
