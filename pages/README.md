# Customer pages

Nuxt creates application routes from the Vue files in this directory.
`user/home.vue` opens the current cafe and order.
`user/card-transfer/_id.vue` handles receipt uploads and receipt status.
`user/liveorder/_id.vue` shows order progress.
`user/profile/` contains account details, addresses, order history, and wallet pages.

Keep account and order state in `store/`.
Use the configured API clients from `plugins/axios.js` for backend requests.
