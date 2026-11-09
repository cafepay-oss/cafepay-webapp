export default ({ app, store }) => {
  let localStorageToken = localStorage.getItem("token");
  if (!!localStorageToken && localStorageToken != 'null' && localStorageToken != 'undefined') {
    store.commit('setToken', localStorageToken)
  } else {
    let token = app.$cookies.get('CafepayWebappToken')
    if (token && token.token) store.commit('setToken', token.token)
  }
  
  // let tableToken = localStorage.getItem('tableToken')
  // if (tableToken != 'undefined' && tableToken != 'null') {
  //   let tableName = localStorage.getItem('tableName')
  //   let table = {
  //     number: tableName,
  //     token: tableToken
  //   }
      
  //   store.commit('table/setToken', table)
  // }
}
// window.onNuxtReady(() => {
//   console.log('Nuxt.js is ready and mounted')
// })
