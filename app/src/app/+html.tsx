import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const TITLE = 'SnapClaim';
const DESCRIPTION = 'Snap the bill. Clear the claim. Expense claims for Qugen Pathlabs: snap a receipt, let it read itself into a claim, get it approved and cleared at month-end.';
const ORIGIN = 'https://expense.genomicslab.in';

/**
 * The document every web page is served in: branding, icons, manifest and social
 * tags. Runs only at export time in Node. headNodes carry the generated styles and
 * bodyNodes the script bundles; without them the page is an empty shell.
 */
export default function Root({ children }: PropsWithChildren) {
  const { headNodes, bodyNodes, htmlAttributes, bodyAttributes } = useServerDocumentContext();
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="application-name" content={TITLE} />
        <meta name="apple-mobile-web-app-title" content={TITLE} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#F6F4EF" />
        <meta name="color-scheme" content="light" />
        <meta name="robots" content="noindex" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icon-180.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={TITLE} />
        <meta property="og:title" content="SnapClaim — Snap the bill. Clear the claim." />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={ORIGIN} />
        <meta property="og:image" content={`${ORIGIN}/og.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SnapClaim — Snap the bill. Clear the claim." />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={`${ORIGIN}/og.png`} />
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
