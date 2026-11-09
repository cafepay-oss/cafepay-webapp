import Vue from 'vue'
import VueGtm from 'vue-gtm'

export default ({ app, $config }) => {
  if ($config.CAFEPAY_DISABLE_ANALYTICS || !$config.CAFEPAY_WEBAPP_GTM_ID) return

  Vue.use(VueGtm, {
    id: $config.CAFEPAY_WEBAPP_GTM_ID,
    defer: false,
    enabled: true,
    debug: false,
    loadScript: true,
    vueRouter: app.router
  })
}
