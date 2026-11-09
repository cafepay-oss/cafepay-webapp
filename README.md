# CafePay Customer App

Customers use this web application to view menus, place orders, and pay at cafes and restaurants.
It supports table orders, pickup orders, delivery, order tracking, and wallet payments.
The interface includes Persian and English text.
Card transfer pages currently use Persian.

This repository contains the Nuxt 2 and Vue 2 application.
The [backend](https://github.com/cafepay-oss/cafepal) provides accounts, orders, payments, and live updates.
Staff use [CafePay Admin](https://github.com/cafepay-oss/cafepay-admin) to manage each cafe.

## Run locally

The backend repository includes Docker Compose setup for the complete application.
Clone the repositories into one directory:

```sh
git clone https://github.com/cafepay-oss/cafepal.git
git clone https://github.com/cafepay-oss/cafepay-webapp.git
git clone https://github.com/cafepay-oss/cafepay-admin.git
```

Follow the [local setup guide](https://github.com/cafepay-oss/cafepal/blob/main/LOCAL_SETUP.md).
It explains database setup, demo data, local accounts, and service startup.
The customer application opens at [localhost:3000](http://localhost:3000).
The admin application opens at [localhost:3001](http://localhost:3001).
The local setup uses test payments.
Use sample customer data and test receipts.

After source changes, rebuild the customer application from the backend directory:

```sh
docker compose --env-file .env.local -f compose.local.yml build webapp
docker compose --env-file .env.local -f compose.local.yml up -d --no-deps webapp
```

## Web app development

Start the backend first.
Use Node 14.21.3 and npm 8.19.4 for dependency installation and builds.
The local Docker build uses these versions because this application includes older build dependencies.
Use an isolated development environment for these older tools.
The root `Dockerfile` belongs to an older deployment setup.
Use the backend Compose setup for the tested local build.

Install the recorded dependencies:

```sh
npm ci --legacy-peer-deps --no-audit --no-fund
```

Set these values in the same shell before starting the development server:

```sh
export CAFEPAY_WEBAPP_BASE_URL=http://localhost:8000/api/
export CAFEPAY_WEBAPP_SOCKET_URL=ws://localhost:8000/
export CAFEPAY_WEBAPP_MEDIA_URL=http://localhost:8000/
export CAFEPAY_WEBAPP_DEFAULT_LOCALE=fa
export CAFEPAY_WEBAPP_SENTRY_DSN=
export CAFEPAY_DISABLE_ANALYTICS=true
export CAFEPAY_LOCAL_RECOVERY=true
export CAFEPAY_MOCK_PAYMENTS=true
npm run dev
```

Stop the Compose `webapp` service first if it already uses port `3000`.
The default configuration uses localhost addresses and disables analytics and error reporting.
Set your own addresses before deployment.
Environment changes require a server restart or a new build.

| Setting | Purpose |
| --- | --- |
| `CAFEPAY_WEBAPP_BASE_URL` | Backend API address, including `/api/` |
| `CAFEPAY_WEBAPP_SOCKET_URL` | Backend WebSocket address, including the final `/` |
| `CAFEPAY_WEBAPP_MEDIA_URL` | Address for public cafe and product images |
| `CAFEPAY_WEBAPP_DEFAULT_LOCALE` | Default language: `fa` or `en` |
| `CAFEPAY_WEBAPP_NUXT_HOST` | Development server host; default `0.0.0.0` |
| `CAFEPAY_WEBAPP_NUXT_PORT` | Development server port; default `3000` |
| `CAFEPAY_WEBAPP_SENTRY_DSN` | Error reporting address; an empty value disables reporting |
| `CAFEPAY_DISABLE_ANALYTICS` | Analytics stays disabled unless you set `false` |
| `CAFEPAY_WEBAPP_GTM_ID` | Your Google Tag Manager ID; empty by default |
| `CAFEPAY_WEBAPP_MAP_TILE_URL` | Map image address; defaults to OpenStreetMap tiles |
| `CAFEPAY_WEBAPP_MAP_ATTRIBUTION` | Map credit text; defaults to OpenStreetMap attribution |
| `CAFEPAY_LOCAL_RECOVERY` | Enables local recovery features when set to `true` |
| `CAFEPAY_MOCK_PAYMENTS` | Enables test checkout together with local recovery mode |

The browser can read these settings.
Do not put passwords or private keys in them.

To enable analytics, set your own `CAFEPAY_WEBAPP_GTM_ID` and set `CAFEPAY_DISABLE_ANALYTICS=false`.
Maps use OpenStreetMap tiles by default.
Read the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/) before deployment.
Set your own map provider address and credit text when you use another service.

## Card transfers

A cafe manager enables card transfers in the admin application.
Customers can then select this method for pickup or delivery orders.
The payment page shows the destination card, account holder, and amount.
Amounts use toman, with a separate rial value for bank applications.

Customers transfer the money through their bank application.
They then select a PNG, JPEG, or WebP receipt, up to `8 MiB`.
Selecting the receipt starts the upload and submits the order.
Staff can start preparation before they confirm receipt of the money.
The application shows receipt submission and payment confirmation as separate states.

A failed upload keeps the selected file available for another attempt.
The application also checks whether the backend saved the receipt before a connection failed.
If the order changes, the customer must review the new amount.
The customer should check an existing transfer before sending more money.

See the [card transfer guide](https://github.com/cafepay-oss/cafepal/blob/main/CARD_TRANSFERS.md) for backend setup and staff permissions.

## Build for deployment

Set your installation addresses before building.
Disable local recovery and test payments for a real installation.
Keep analytics disabled unless you configure your own Google Tag Manager account.
Set your own error reporting address, or leave it empty.

Create the static application:

```sh
npm run generate
```

Serve the resulting `dist/` directory with a web server.
Configure the server to serve `index.html` for application routes.
The backend repository includes the local Nginx configuration.

The project also provides the original Nuxt server commands:

```sh
npm run build
npm start
```

## Checks

Run the tests with Node 18 or newer.
These tests need no dependency installation:

```sh
npm test
```

These checks cover checkout, receipt uploads, payment amounts, order changes, sessions, menus, network errors, and wallet behavior.
They do not replace a build or browser checks.
Check table entry, login, ordering, receipt upload, order tracking, and recovery from connection failures in the browser.
Use demo data for these checks.

## Find the code

| Directory | Contents |
| --- | --- |
| `pages/` | Customer pages and routes |
| `components/` | Menus, checkout, scanning, and account controls |
| `store/` | Customer, cafe, order, and payment state |
| `plugins/` | API requests, live updates, translations, and browser integrations |
| `middleware/models/` | Shared data models |
| `lang/` | Persian and English text |
| `assets/` | Styles and bundled images |
| `static/` | Fonts, icons, and files served directly |
| `tests/` | Automated checks |

Report bugs with the page, browser version, steps to reproduce, and expected result.
Remove passwords, tokens, customer details, and real receipts from reports.

## License and included assets

CafePay code uses the [MIT license](LICENSE).
The interface uses [Vazirmatn v33.003](https://github.com/rastikerdar/vazirmatn/tree/v33.003).
Its [SIL Open Font License](static/fonts/OFL.txt) applies to the included font files.
Font Awesome Free 5.15.4 uses the terms in [its license notice](assets/fontawesome/LICENSE.txt).
