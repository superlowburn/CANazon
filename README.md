# CANazon

> Chrome Web Store submission is in progress. Until approval, install CANazon using the ZIP instructions below.

CANazon is a small Chrome extension that makes Canadian brands easier to spot while shopping on Amazon.

- Canadian brands get a large red maple leaf.
- Recognized American brands get heavy frost and a red X.
- Click **Reveal** to uncover a frosted listing.
- Unknown brands stay visible.

## What it looks like

![CANazon highlighting a Canadian product and frosting an American product on Amazon](store-assets/CANazon-store-screenshot-1280x800.png)

## Install from the ZIP

Chrome cannot install the ZIP directly. Unzip it first.

1. Download `CANazon-0.1.0.zip`.
2. Double-click the ZIP to extract it.
3. Open `chrome://extensions` in Chrome.
4. Turn on **Developer mode**.
5. Click **Load unpacked**.
6. Select the extracted `CANazon-0.1.0` folder—the folder containing `manifest.json`.
7. Open or refresh an Amazon page.

To update CANazon later, replace the extracted folder with the new version and click **Reload** on the CANazon card in `chrome://extensions`.

## Where it works

CANazon currently handles Amazon search results, category grids, and category-specific Best Sellers pages. Some homepage, Deals, storefront, and recommendation cards are not supported yet.

Brand matching is based on bundled title and brand lists. It is a shopping aid, not a guarantee of ownership or manufacturing origin.

## Privacy

CANazon runs locally in Chrome. It has no accounts, tracking, analytics, or extension-runtime network requests.

## Development

Load this repository with **Load unpacked**, then run:

```bash
node --test tests/*.test.mjs
```

Canadian brand data is compiled from the r/BuyCanadian community wiki. Code is MIT licensed.
