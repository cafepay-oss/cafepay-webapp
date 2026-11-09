import Vue from 'vue'
import Vuex from 'vuex'
import { authCookieOptions } from '~/utils/auth-cookie'


Vue.use(Vuex)

export const state = () => ({
  errorMessage: null,
  globalLoading: false,
  errorThrow: false,
  baseUrl: null,
  activeCafe: {},
  firstTimeActive: false,
  activeTable: {},
  hasActiveTable: false,
  fistTimeCameraActive: false,
  token: null,
  backToScan: false,
  socket: {
    isConnected: false,
    message: '',
    reconnectError: false,
  },
  guides: {
    changeOrderConfirm: false,
    cashierSelection: false,
  },
  currentMainPage: (state.hasActiveTable) ? 'currentCafe' : 'scan',
})

export const mutations = {
  setBaseUrl(state, baseUrl) {
    state.baseUrl = baseUrl
  },
  SOCKET_ONOPEN(state, event) {
    Vue.prototype.$socket = event.currentTarget
    state.socket.isConnected = true
    this.dispatch('table/tableConnection')
    // if (state.cafe.tokenType == 'normal') 
    // else if (state.cafe.tokenType == 'preorder') this.dispatch('table/preorderConnection')

  },
  SOCKET_ONMESSAGE(state, rawMessage) {

    let envelope
    try {
      envelope = JSON.parse(rawMessage.data)
    } catch (error) {
      return
    }
    const message = envelope && envelope.message
    if (!message || typeof message.source !== 'string') return
    state.socket.message = envelope
    if (message.source ==
      `table.${state.table.token}.join.simple.by-token.`) {
        if ( message.status_code == 200) {
           console.log('table socket message', message.data);
            this.commit('table/setData', message.data)
        }
        else if (message.status_code == 404) {
          Vue.prototype.$disconnect()
          this.commit('table/clearData')
          this.commit('user/clearTable_uuid')
          this.commit('cafe/setType', null)
          this.commit('cafe/bindProductCount', false)
        }
       
    } 

  },
  SOCKET_ONCLOSE(state, event) {
    console.log('server is disconnected');

    state.socket.isConnected = false
  },
  SOCKET_ONERROR(state, event) {
    console.error(state, event)
  },
  // default handler called for all methods

  // mutations for reconnect methods
  SOCKET_RECONNECT(state, count) {
    console.info(state, count)
  },
  SOCKET_RECONNECT_ERROR(state) {
    state.socket.reconnectError = true;
  },
  toggleLoading(state, flag) {
    state.globalLoading = flag
  },
  setActiveTable(state, flag) {
    state.hasActiveTable = flag
  },

  unsetIsConnectedFlag(state) {
    state.socket.isConnected = false
  },
  // setActiveTable(state, table){
  //   state.activeTable = table
  // },
  setToken(state, token) {
    state.token = token
    localStorage.setItem('token', token)
    const cookieValObject = {'token': `${token}`}
    this.$cookies.set('CafepayWebappToken', cookieValObject, authCookieOptions(window.location))
  },
  clearToken(state) {
    localStorage.removeItem('token')
    try { window.sessionStorage.removeItem('cafepay.checkout') } catch (error) {}
    this.$cookies.remove('CafepayWebappToken', authCookieOptions(window.location))
    state.token = null
  },
  backToScan(state, flag){
    state.baseUrl = flag
  },
  changeNavigation(state, PageName) {
    state.currentMainPage = PageName
    history.pushState({
      state: PageName
    }, '/user/home?' + PageName)
  },
  errorMsg(state, err) {
    state.errorThrow = true
    state.errorMessage = err
    // setTimeout(() => {
    // }, 200); 
  },
  unsetErrorFlag(state){
    state.errorThrow = false
  },
  setFirstTime(state , flag){
    state.firstTimeActive = flag
  },
  setFirstTimeCameraActive(state, flag) {
    state.fistTimeCameraActive = flag
  },
  setGuide(state, guide) {
      state.guides[guide.name] = guide.data
  }
}

export const actions = {
  async resolveGuestTable({ state, commit }) {
    if (!state.cafe.guestBrowsing) return
    const entryToken = state.cafe.entryToken
    const cafeId = state.cafe.pk
    if (!state.token || !entryToken) throw new Error('ورود به حساب برای ثبت سفارش لازم است.')
    try {
      const response = await this.$api.get(`v1/table-token/${entryToken}/cafe-info/`)
      const data = response.data
      if (state.cafe.pk !== cafeId || state.cafe.entryToken !== entryToken) {
        throw new Error('مجموعه تغییر کرده است؛ سفارش را دوباره بررسی کنید.')
      }
      if (data.cafe.pk !== cafeId || data.menu_only || !data.table || !data.table.uuid) {
        throw new Error('ابتدا سفارش فعال قبلی را تکمیل کنید؛ انتخاب‌های شما محفوظ است.')
      }
      commit('cafe/setBasic', data)
      commit('table/setToken', {
        token: data.type == 2 ? data.table.uuid : data.token,
        number: data.type == 2 ? 'پیش سفارش' : data.table.number
      })
      commit('cafe/setGuestBrowsing', false)
      Vue.prototype.$connect()
      return data
    } catch (error) {
      commit('errorMsg', (error.response && error.response.data && error.response.data.detail) ||
        error.message || 'ارتباط برقرار نشد؛ دوباره تلاش کنید.')
      throw error
    }
  },
  logout({ commit }) {
    Vue.prototype.$disconnect()
    commit('unsetIsConnectedFlag')
    commit('clearToken')
    commit('user/clear')
    commit('table/clearData')
    commit('cafe/clear')
    commit('changeNavigation', 'profile')
  },
  nuxtServerInit({ commit }, { $config }) {
    commit('setBaseUrl', $config.CAFEPAY_WEBAPP_BASE_URL)
  },
  sendCode({
    commit,
    dispatch
  }, data) {
      if (data.cafe) {
          commit('cafe/setGuestBrowsing', false)
          commit('cafe/setBasic', data.cafe)
          commit('setActiveTable', true)
          commit('table/setToken', {
            token: data.tableToken,
            number: 'پیش سفارش'
          })
          dispatch('cafe/retrieveMenu')
      }
      else {
      return new Promise((resolve, reject) => {
        let api = (data.hasToken) ? '$api' : '$axios'
        console.log('api type', api);
        // u need to set the table too, for api link
        this[api]
          .get('v1/table-token/' + data.tableToken + '/cafe-info/', {
            params: {},
            // headers: { Authorization: 'Token ' + this.token }
          })
          .then(res => {
            // sets pk, avatar, name and table id
            commit('cafe/setEntryToken', { token: data.tableToken, guest: !data.hasToken })
            commit('cafe/setBasic', res.data)
            commit('setActiveTable', true)
            // if TYPE == 2 it's preorder and token would be table uuid
            if (!data.hasToken) {
              commit('table/setToken', { token: null, number: '' })
            } else if (res.data.type == 2){
              commit('table/setToken', {token: res.data.table.uuid, number: 'پیش سفارش'})
            }
            else {
              res.data.table['token'] = res.data.token
              // save active table state in localstorage for refresh (no longer valid)
              commit('table/setToken', res.data.table)
            }
            // execute the action for getting menu, detailed info, comments and posts
            dispatch('cafe/retrieveMenu')



           if (res.data.has_staff_order) commit('changeNavigation', 'cp-table')
           else commit('changeNavigation', 'currentCafe')
            resolve(res)
          })
          .catch(err => {
            reject(err)
          })
      })
    }

  },
}
