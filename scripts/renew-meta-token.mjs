// User token corto -> user token largo -> Page tokens de larga duración.
// Uso (sin los signos < >):
// node scripts/renew-meta-token.mjs "APP_ID" "APP_SECRET" "USER_TOKEN"

const [appId, appSecret, shortToken] = process.argv.slice(2);

if (!appId || !appSecret || !shortToken) {
  console.error(
    'Uso: node scripts/renew-meta-token.mjs "APP_ID" "APP_SECRET" "USER_TOKEN"',
  );
  process.exit(1);
}

const graph = 'https://graph.facebook.com/v21.0';
const exchangeUrl = new URL(`${graph}/oauth/access_token`);
exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token');
exchangeUrl.searchParams.set('client_id', appId);
exchangeUrl.searchParams.set('client_secret', appSecret);
exchangeUrl.searchParams.set('fb_exchange_token', shortToken);

const exchangeResponse = await fetch(exchangeUrl);
const exchange = await exchangeResponse.json();
if (!exchangeResponse.ok || exchange.error) {
  console.error(
    'No se pudo alargar el User Token:',
    exchange.error?.message ?? exchange,
  );
  process.exit(1);
}

const accountsUrl = new URL(`${graph}/me/accounts`);
accountsUrl.searchParams.set('access_token', exchange.access_token);
const accountsResponse = await fetch(accountsUrl);
const accounts = await accountsResponse.json();
if (!accountsResponse.ok || accounts.error) {
  console.error(
    'No se pudieron consultar las páginas:',
    accounts.error?.message ?? accounts,
  );
  process.exit(1);
}

for (const page of accounts.data ?? []) {
  console.log('\n────────────────────────────────────────');
  console.log(`Página: ${page.name}`);
  console.log(`Page ID: ${page.id}`);
  console.log('Page Token de larga duración:');
  console.log(page.access_token);
}
