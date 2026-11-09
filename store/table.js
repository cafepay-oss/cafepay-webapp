import Vue from 'vue'
import { saveCheckoutContext } from '~/utils/checkout-context'

import {
  Table
} from '../middleware/models/table'
export const state = () => ({

  table_number: null,
  token: null,
  status: null,
  paymentMethod: 'online',
  cafe: '',
  tpayment: 0,
  joinId: null,
  cardTransfer: null,
  persons: [],
  payment: {},
  description: null,
  address: null,
  empty: true,
  hasOnlinePayment: false,
  yourOrdersCost: 0,
  yourOrdersPaid: 0,
  paid: false,
  hasCashierOrder: false,
  keepAlive: false,
  you: {
    orders: []
  },
})

export const getters = {

  totalWishToPay(state) {
    let others = state.persons.reduce((sum, person) => {
      let innerSum = person.orders.reduce((innerSum, order) => order.wish_to_pay + innerSum, 0)
      return innerSum + sum
    }, 0)
    // let others = state.persons.reduce((Sum, person) => person.totalPaid + Sum, 0)
    // return others + state.you.orders.reduce((Sum, order) => order.wish_to_pay + Sum, 0)
    return others
  },



}

export const mutations = {
  setCardTransfer(state, transfer) {
    if (state.joinId === transfer.join) state.cardTransfer = transfer
  },
  setToken(state, table) {
    state.token = null
    state.table_number = null

    state.token = table.token
    state.table_number = table.number
  },
  
  setKeepAlive(state) {
    state.keepAlive = true
  },

  clearData(currentState) {
    this.commit('setActiveTable', false)
    this.commit('changeNavigation', 'scan')
    Object.assign(currentState, state())
  },

  setData(state, rawData) {
    // this is raw data from socket
    // compute data by person and his orders
    // back-end doesn't give product name on table ... 
    //.. so get it from cafe store
    // first compute an array of products from categories (flatten products then)
    let products = this.state.cafe.categories.map(c => c.products)
    products = [].concat.apply([], products)
    // we pass the user id for slider to be full for user
    let table = new Table(rawData, this.state.user.user.id)
    state.persons = table.persons
    state.payment = rawData.payment_info
    state.description = rawData.description
    state.status = table.status
    state.paid = false
    state.cardTransfer = rawData.card_transfer || null
    state.joinId = rawData.pk
    state.address = rawData.address
    state.paid = table.paid
    state.empty = table.empty
    state.paymentMethod = table.paymentMethod
    state.hasOnlinePayment = table.hasOnlinePayment
    state.hasCashierOrder = table.hasCashierOrder
    // we use this data to handle payment status in preorder
    state.cafe = rawData.cafe


    // bind the user's orders count to menu data
    // first we need to find the user using the app from persons array
    let user = state.persons.find(p => p.id == this.state.user.user.id)
    if (user) {
      state.you = user
      this.commit('cafe/bindProductCount', user)
    } else {
      state.you = { orders: [] }
      this.commit('cafe/bindProductCount', null)
    }

  },

  changeChashierCount(state, selection) {
    const person = state.persons.find(person => person.cashier &&
      (selection.personId == null || person.id === selection.personId))
    const order = person && person.orders[selection.index]
    if (!order) return
    order.cashier_count = selection.cashier_count ? 1 : 0
    order.wish_to_pay = order.cashier_count
      ? Math.max(0, order.payment_info.total_amount - order.payment_info.net_payed_amount) : 0
  },

  updateTableDetail(state, data) {

  },
  setOrder(state, orderData) {
    state.yourOrdersCost = orderData.totalPrice
    state.you.orders = orderData.orders
  },
  payWholeBill(state) {
    // for (const order of state.you.orders) {
    //   order.wish_to_pay =order.payment_info.total_amount - order.payment_info.net_payed_amount
    // }
    for (const person of state.persons) {
      for (const order of person.orders) {
        order.wish_to_pay = Math.max(0, order.payment_info.total_amount - order.payment_info.net_payed_amount)
      }
    }
  },
  setDefaultPayment(state) {
    for (const person of state.persons) {
      for (const order of person.orders) {
        order.wish_to_pay = 0
      }
    }
  },
  changeWishToPay(state, orderIdentity) {

    for (const person of state.persons) {

      if (person.name == orderIdentity.name) {
        person.orders[orderIdentity.index].wish_to_pay = orderIdentity.value
        break
      }
    }
  },

  setPayment: (state, value) => state.tpayment = value,

  clearWishToPay(state) {
    // wish to pay to 0 because we dont have redirection to the bank yet
    // maybe need it for good
    for (const person of state.persons) {
      for (const order of person.orders) {
        if (order.wish_to_pay > 0) {
          order.wish_to_pay = 0
        }
      }
    }
  },
  productsPayloadSeperator(state, productChangeArray) {
    // delete capital because we don't need it


  }


}

export const actions = {
  tableConnection(context , preOrderToken) {
    let token = (preOrderToken) ? preOrderToken : context.state.token
    let joinRequest = {
      request: {
        endpoint: `table/${token}/join/simple/by-token/`,
        data: {},
        headers: {
          Authorization: "Token " + context.rootState.token
        },
        method: "WATCH"
      }
    };
    let joinRequest_str = JSON.stringify(joinRequest);
    Vue.prototype.$socket.send(joinRequest_str);

  },


  async changeProductsOnTable(context, req) {
    const token = context.state.token
    const authToken = context.rootState.token
    try {
      const result = await this.$api.$post(`v1/table/${context.state.token}/products/change/`, {
        add: req.add || [],
        remove: req.del || []
      })
      if (context.state.token !== token || context.rootState.token !== authToken) return result
      if (['pre-order', 'delivery'].includes(context.rootState.cafe.tokenType)) {
        context.commit('setKeepAlive')
      }
      context.commit('cafe/clearPCA', null, { root: true })
      context.commit('setData', result)
      context.commit('changeNavigation', 'cp-table', { root: true })
      context.commit('cafe/changeActiveCategory', 0, { root: true })
      return result
    } catch (error) {
      context.dispatch('throwBulkError', error)
      throw error
    }
  },

  throwBulkError(context, error) {
    const response = error && error.response
    const details = response && response.data && response.data.details
    const detail = Array.isArray(details) && details.find(item => item && item.product != null)
    let message = 'ثبت تغییرات انجام نشد. لطفاً دوباره تلاش کنید.'
    if (response && response.status === 410) {
      message = 'سفارش گیری غیرفعال است'
    } else if (response && response.status === 400 && detail) {
      const product = context.rootGetters['cafe/productById'](detail.product)
      if (product) {
        message = detail.remaining > 0
          ? `از محصول ${product.name} فقط ${detail.remaining} موجود است`
          : `${product.name} تمام شده است`
      }
    }
    context.commit('errorMsg', message, { root: true })
  },

  async setPaymentMethod(context, data) {
    try {
      return await this.$api.$post(`/v1/cafe/${context.state.cafe.pk}/pbr/payment/method/`, {
        pbr_payment_methods: data
      })
    } catch (error) {
      context.commit('errorMsg', 'ثبت روش پرداخت انجام نشد. لطفاً دوباره تلاش کنید.', { root: true })
      throw error
    }
  },

  async submitPayment(context, payments) {
    // for now that we dont have backend actual payment

    // first get the orders that you wish to pay

    // context.commit('clearWishToPay')
    try {
      let data = await this.$api.$post(`/v1/pbr/session/create/`, {
        payments
      })
      context.commit('clearWishToPay')
      // context.commit('setPayment', 0)
      // if u wanna vefiry the payment
      context.dispatch('paymentMake', data.invoice_uuid)
    } catch (err) {
      context.commit('errorMsg', $nuxt.$i18n.t('unknown_error'), {
        root: true
      })

    }
  },
  async paymentMake(context, id) {
    try {
      let data = await this.$api.$get(`/v1/payment/make/${id}/`)
      saveCheckoutContext(window.sessionStorage, {
        invoice: id, token: context.state.token, kind: 'table'
      })
      window.location = data.redirect_to
      // this.app.router.push('/paymentResult')
    } catch (err) {
      context.commit('errorMsg', $nuxt.$i18n.t('unknown_error'), {
        root: true
      })
    }
  }
}
