export default function ({ $axios, store, app }, inject) {
  let pending = 0
  const start = config => {
    if (!config._cafepayLoading) {
      config._cafepayLoading = true
      pending++
      store.commit('toggleLoading', true)
    }
  }
  const finish = response => {
    const config = response && response.config
    if (config && config._cafepayLoading) {
      config._cafepayLoading = false
      pending = Math.max(0, pending - 1)
      store.commit('toggleLoading', pending > 0)
    }
  }
  const reportNetworkError = error => {
    if (!error.response && error.code !== 'ERR_CANCELED' && !error.__CANCEL__) {
      const message = app && app.i18n ? app.i18n.t('network_error') : 'ارتباط با سرور برقرار نشد.'
      store.commit('errorMsg', message)
    }
  }
  const configure = (client, blocking, authenticated) => {
    client.onRequest(config => {
      if (blocking) start(config)
      if (authenticated && store.state.token) {
        config.headers.common.Authorization = `Token ${store.state.token}`
      }
      return config
    })
    client.onResponse(response => {
      if (blocking) finish(response)
      return response
    })
    client.onError(error => {
      if (blocking) finish(error)
      reportNetworkError(error)
    })
  }
  configure($axios, true, false)
  const api = $axios.create()
  configure(api, true, true)
  inject('api', api)
  const nonBlockingApi = $axios.create()
  configure(nonBlockingApi, false, true)
  inject('nonBlockingApi', nonBlockingApi)
}
