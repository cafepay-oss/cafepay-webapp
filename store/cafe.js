import Vue from 'vue'
import {
  Category
} from '../middleware/models/cafe'

export const state = () => ({
  pk: null,
  rate: null, phone: null, has_delivery: false, is_delivery: false,
  delivery_regions: [], payment_only: false, payment_first: false,
  activeCategory: 1,
  name: null,
  avatar: null,
  cafepay_fee: 0,
  card_transfer_enabled: false,
  entryToken: null,
  guestBrowsing: false,
  productChangeArray: [],
  categories: [],
  currentProduct: {},
  productsFork: [],
  productPageActive: false,
  flowType: null,
  tokenType: 'normal',
  totalCount: 0,
  storeRedirect: false,
  closed: false,
  active: false,
  list: [],
  fee_payer: false,
  header_image: null,
  my_credit_in_cafe: 0,
})

export const getters = {
  productsFlatten: state => {
    const all = state.categories.find(category => category.localType === 'ALL')
    return all ? all.products : []
  },



  productById: (state, getters) => (id) => {
    return getters.productsFlatten.find(p => p.pk == id)
  }
}

export const mutations = {
  setEntryToken(state, { token, guest }) {
    state.entryToken = token
    state.guestBrowsing = guest
  },
  setGuestBrowsing(state, guest) { state.guestBrowsing = guest },
  setBasic(state, data) {
    state.rate = (data.cafe.rate) ? data.cafe.rate : 4
    state.card_transfer_enabled = !!data.cafe.card_transfer_enabled
    state.pk = data.cafe.pk
    state.name = data.cafe.name
    state.phone = data.cafe.phone
    state.closed = data.cafe.is_closed
    state.avatar = data.cafe.avatar
    state.has_delivery = data.cafe.has_delivery
    state.cafepay_fee = data.cafe.cafepay_fee
    state.fee_payer = data.cafe.fee_payer
    state.header_image = data.cafe.header_image
    state.payment_only = data.cafe.payment_only
    state.payment_first = data.cafe.payment_first
    state.my_credit_in_cafe = data.my_credit_in_cafe
    state.is_delivery = data.is_delivery
    state.delivery_regions = data.cafe.delivery_regions

    // define type of token ----- 0: menuonly   1: normal    2: preorder
    switch (data.type) {
      case '0':
        state.tokenType = 'menu-only'
        break;
      case '1':
        state.tokenType = 'normal'
        break;

      case '2':
        if (data.has_delivery) state.tokenType = 'delivery'
        else state.tokenType = 'pre-order'
        break;
    
      default:
        break;
    }


  },

  changeStoreRedirect(state, flag)  {
    state.storeRedirect = flag
  },

  setType(state, type) {
    state.tokenType = type
    
  },

  clear(currentState) {
    Object.assign(currentState, state())
  },
  changeCount(state, setting) {
    state.totalCount += setting.count

    let theProduct = state.categories[setting.categoryIndex].products[setting.productIndex];
    theProduct.count += setting.count

    for (const category of state.categories) {
      for (const product of category.products) {
        if (theProduct.pk == product.pk) {
          product.count = theProduct.count
          break
        }
      }
    }
    
    if(theProduct.count > 0) {
      // check if product exist in my order category (firstCateogry) or not
      if(!state.categories[0].products.find(p => p.pk == theProduct.pk)) {
        state.categories[0].products.push(theProduct)
      }
    }
    // // if its not from filtered category indexes are legit so we need no find
    // if (!setting.filtered) {
    //   state.categories[setting.categoryIndex].products[setting.productIndex].count += setting.count
    // } else {
    //   // we have product id and we need to find it in out main menu and update it
    //   for (const category of state.categories) {
    //     for (const product of category.products) {
    //       if (setting.id == product.pk) {
    //         product.count += setting.count
    //         break;
    //       }
    //     }
    //   }
    // }
  },

  setMenu(state, menu) {
    state.active = true
    // clear categories in-case user re-enter 
    state.categories = []
    // push current basket of orders first for editing current orders
    // TODO: move this line out of store
    state.categories.push({
      localType: 'CURRENT_ORDER',
      pk: -1,
      name: this.app.i18n.t('menu_page.your_current_order'),
      products: []
    })

    const categories = [...menu.categories].sort((c1, c2) => c1.order - c2.order)
    let allProducts = categories.reduce(
      (products, cat) => products.concat(cat.products),
      []
    )
    // Make them unique
    allProducts = Array.from(new Map(allProducts.map(product => [product.pk, product])).values())
    state.categories.push(new Category({
      localType: 'ALL',
      pk: 0,
      title: this.app.i18n.t('menu_page.all_products'),
      products: allProducts
    }))

    for (const category of categories) {
      state.categories.push(new Category(Object.assign({
        localType: 'CATEGORY',
      },category)))
    }
  },

  setCurrentProduct(state, product) {
    state.currentProduct = product
    state.productPageActive = true
  },
  clearProduct(state) {
    state.currentProduct = {}
    state.productPageActive = false
  },

  clearPCA: (state) => {
    state.productChangeArray = []
  },

  changeActiveCategory: (state, index) => {
    state.activeCategory = index
  },

  setList:(state, data) => {
    state.list = data
  },

  clearBasket(state) {
    if (state.categories[0]) state.categories[0].products = []
  },
  bindProductCount(state, user) {
    const basket = state.categories.find(category => category.localType === 'CURRENT_ORDER')
    if (!basket) return
    const orders = user && Array.isArray(user.orders) ? user.orders : []
    const pending = new Map(state.productChangeArray.map(change => [change.product, change.count]))
    const selected = new Map()
    for (const category of state.categories) {
      if (category.localType === 'CURRENT_ORDER') continue
      for (const product of category.products) {
        const matches = orders.filter(order => order.product == product.pk)
        product.reduceLimit = matches.reduce((total, order) => total +
          (order.unit_amount > 0 ? Math.ceil(order.payment_info.net_payed_amount / order.unit_amount) : 0), 0)
        const savedCount = matches.reduce((total, order) => total + order.count, 0)
        product.count = Math.max(0, savedCount + (pending.get(product.pk) || 0))
        if (product.count > 0 && !selected.has(product.pk)) selected.set(product.pk, product)
      }
    }
    basket.products = Array.from(selected.values())
    state.totalCount = basket.products.reduce((total, product) => total + product.count, 0)
  },

  changeDetection(state, product) {
    // let's see if its already exist in product change array
    let MatchIndex = state.productChangeArray.findIndex(p => p.product == product.id)

    if (MatchIndex != -1) {
      // if it exist find it on the array and change it
      state.productChangeArray[MatchIndex].count += product.count
      state.productChangeArray[MatchIndex].capital += product.count * product.price
      if (state.productChangeArray[MatchIndex].count == 0) {
        state.productChangeArray = state.productChangeArray.filter(p => p.product != product.id)
      }

    } else {
      // if not push it to the array
      state.productChangeArray.push({
        product: product.id,
        count: product.count,
        capital: product.count * product.price
      })

    }
    // console.log('rpoduct change array', state.productChangeArray);


  },


}

export const actions = {
  async retrieveMenu(context) {
    const cafeId = context.state.pk
    try {
      let data = await this.$axios.$get(`/v1/cafe/${context.state.pk}/category-based-menu/active/`, {
        // params: {},
        // headers: {
        //   'Authorization': 'Token ' + context.rootState.token,
        // }
      })
      // console.log('cafe menu', data);
      if (context.state.pk !== cafeId) return
      context.commit('setMenu', data)
      context.commit('changeActiveCategory', 1)
      // after retrieving the menu we need to establish a connection with socket to retrieve table data
      // why after menu data ? because we need menu data for build table data
      // if sina give me the name of product with table data then we don't need this sequence anymore
      // connect to socket
      // console.log('state', context.state.tokenType);
      // determine that is user is logged in or Not if Yes we need to check if he has any order to furthur open the socket #DEPRECATED due to cashier orders now we just check loggedIn status
      // if (context.rootState.user.user.id) context.dispatch('user/hasActiveOrder', context.rootState.table.token , {root: true})

      console.log('state', context.state.tokenType);
      if (context.state.tokenType != 'menu-only' && !context.state.closed && context.rootState.user.user.id) Vue.prototype.$connect()
    } catch (err) {

    }
  },
    async retreiveList(context) {
      try {
        let data = await this.$axios.$get(`/v1/cafe/list/`, {
        })
        context.commit('setList', data)
      } catch (err) {

      }

    },
}
