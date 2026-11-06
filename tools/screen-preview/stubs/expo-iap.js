// A stand-in for expo-iap in the screen preview only: connected, with the
// family's prices, so the money shelf draws as a player sees it.
const PRICES = { remove_ads: '$3.99', coins_pouch: '$0.99', coins_chest: '$4.99', coins_vault: '$9.99', season_pass_1: '$2.99', starter_pack: '$4.99' };
module.exports = {
  initConnection: async () => true,
  fetchProducts: async ({ skus }) => skus.filter((s) => PRICES[s]).map((id) => ({ id, displayPrice: PRICES[id] })),
  purchaseUpdatedListener: () => ({ remove() {} }),
  purchaseErrorListener: () => ({ remove() {} }),
  getAvailablePurchases: async () => [],
  restorePurchases: async () => {},
  requestPurchase: async () => {},
  finishTransaction: async () => {},
};
