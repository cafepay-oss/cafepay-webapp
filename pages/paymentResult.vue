<template>
  <div class="payment-result-container" :dir="$dir()">

      <img src="@/assets/img/shape/payment-logo.png" alt="">
      <div class="cp-card cp-side-padding cp-tb-padding has-background-white shadow-xl">
        <div ref="paymentAnimation" class="payment-animation" aria-hidden="true"></div>
        <p v-if="info.status != 200">{{info.description}}</p>
        <p class="font-18" v-if="info.status == 200" v-html="$t('payment_result.payment_result_success')"></p>
        <p class="font-18" v-if="info.status != 200" v-html="$t('payment_result.payment_result_error')"></p>
        <p v-if="info.status == 200" class="">{{ $t('payment_result.payed_amount') }}: <span class="total-price">{{info.amount | currency}}
          <!-- <span class="toman">تومان</span> -->
        </span></p>
        <p :dir="$dir()" v-if="info.status != 200">{{ $t('payment_result.transaction_id') }}:‌</p>
        <p v-if="info.status != 200">{{info.uuid}}</p>
        <p v-if="returnError" role="alert">{{ returnError }}</p>
        <b-button :loading="returning" :disabled="returning" expanded @click="backtoapp" class="back-to-app bcp-btn-large" type="is-info">{{ $t('payment_result.return_to_application') }}</b-button>

    </div>
  </div>
</template>

<script>
import Vue from 'vue'
import lottie from 'lottie-web'
import successfullPayment1 from '~/assets/img/27572-success-animation.json'
import errorAnimation from '~/assets/img/error.json'
import { readCheckoutContext } from '~/utils/checkout-context'

export default {
  data() {
    return { returning: false, returnError: null }
  },
  computed: {
    info() {
      const info = { ...this.$route.query }
      if (info.description === 'previously verifed') info.status = 200
      return info
    }
  },
  methods: {
    async backtoapp() {
      if (this.returning) return
      this.returning = true
      this.returnError = null
      try {
        this.$store.commit('table/clearWishToPay')
        const context = readCheckoutContext(window.sessionStorage, this.info.uuid)
        if (this.info.table_type == 2 && this.info.table_uuid) {
          this.$store.commit('unsetIsConnectedFlag')
          Vue.prototype.$disconnect()
          this.$store.commit('table/clearData')
          this.$store.commit('cafe/bindProductCount', false)
          await this.$router.push(this.localePath(`/user/liveorder/${this.info.table_uuid}`))
        } else if (this.info.table_type == null && (!context || context.kind === 'wallet')) {
          await this.$router.push(this.localePath('/user/profile/wallet'))
        } else {
          const token = context && context.token
          if (token) {
            await this.$store.dispatch('sendCode', {
              tableToken: token, hasToken: !!this.$store.state.token
            })
            this.$store.commit('changeNavigation', 'cp-table')
          } else {
            this.$store.commit('changeNavigation', 'scan')
          }
          await this.$router.push(this.localePath('/user/home'))
        }
      } catch (error) {
        this.returnError = 'بازگشت انجام نشد. لطفاً دوباره تلاش کنید.'
      } finally {
        this.returning = false
      }
    }
  },
  mounted() {
    this.paymentAnimation = lottie.loadAnimation({
      container: this.$refs.paymentAnimation,
      renderer: 'svg', loop: false, autoplay: true,
      animationData: this.info.status == 200 ? successfullPayment1 : errorAnimation
    })
  },
  beforeDestroy() {
    if (this.paymentAnimation) this.paymentAnimation.destroy()
  }
}
</script>

<style scoped lang="sass">
@import '~/assets/sass/variables.sass'
.payment-result-container
  min-height: 100vh
  min-height: 100dvh
  padding: 24px 16px
  display: flex
  flex-direction: column
  justify-content: center
  align-items: center
  gap: 24px
  > img
    display: block
    width: 180px
    max-width: 55%
    height: auto
  .cp-card
    width: 100%
    max-width: 480px
    text-align: center
    border-radius: 10px
    overflow-wrap: anywhere
    flex-shrink: 0
  .payment-animation
    width: 120px
    height: 120px
    margin: 0 auto 12px
  .total-price
    font-size: 18px
  .back-to-app
    margin-top: $margin
    height: auto
    min-height: 45px
    white-space: normal
@media (max-height: 480px)
  .payment-result-container
    justify-content: flex-start
    gap: 12px
    > img
      width: 120px
    .payment-animation
      width: 80px
      height: 80px
</style>
