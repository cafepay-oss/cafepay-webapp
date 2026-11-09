<template>
  <div :dir="$dir()" class="wallet-page">
    <div class="cp-header cp-tb-padding cp-side-padding">
      <button @click="$router.go(-1)" class="wallet-back go-back cp-tb-padding" aria-label="بازگشت">
        <b-icon size="is-medium" icon="chevron-left" type="is-light"></b-icon>
      </button>
    </div>
    <div class="profile-info-bar cp-side-padding cp-tb-padding long-shadow cp-side-margin cp-header-card has-background-white">
      <div class="info">
        <img class="no-pic" src="@/assets/img/shape/icons/wallet.png" alt="" />
        <h4 class="header cp-tb-padding cp-side-padding">موجودی و تراکنش‌ها</h4>
        <p class="detail cp-tb-padding cp-side-padding">
          موجودی:
          <span v-if="balance != null" class="p-text font-18">{{ balance | currency }}</span>
          <span v-else>—</span>
        </p>
      </div>
    </div>
    <section class="content-below-profile-bar cp-side-margin">
      <form class="charge-wallet cp-b-margin-2x" @submit.prevent="chargeWallet">
        <div class="wallet-amount-options cp-b-margin">
          <button v-for="amount in amountOptions" :key="amount" type="button"
            @click="payAmount = String(amount)" :aria-pressed="normalizedAmount === amount"
            class="font-16 cp-btn cp-btn-primary-inverted">
            {{ amount | currency }}
          </button>
        </div>
        <b-field label="مبلغ افزایش موجودی (تومان)">
          <b-input inputmode="numeric" v-model="payAmount" class="cp-input cp-input-primary"
            placeholder="مبلغ را وارد کنید" :disabled="charging"></b-input>
        </b-field>
        <p v-if="chargeError" class="wallet-error cp-b-margin" role="alert">{{ chargeError }}</p>
        <b-button native-type="submit" :disabled="!normalizedAmount || charging" :loading="charging"
          class="bcp-btn bcp-btn-large btn-font-bold" type="is-success" expanded>پرداخت</b-button>
      </form>
      <div class="transaction-list" :aria-busy="loading">
        <header class="font-16 font-norm cp-b-margin">لیست تراکنش‌ها</header>
        <p v-if="loading">در حال دریافت تراکنش‌ها…</p>
        <div v-else-if="loadError" role="alert">
          <p class="wallet-error">{{ loadError }}</p>
          <b-button @click="loadWallet" type="is-info">تلاش دوباره</b-button>
        </div>
        <p v-else-if="!transactions.length">تراکنشی ثبت نشده است.</p>
        <div v-for="transaction in transactions" :key="transaction.pk"
          class="cp-card wallet-transaction has-background-white cp-padding cp-b-margin">
          <span v-if="transaction.create_datetime" class="font-12 grey-text">
            {{ transaction.create_datetime | cmoment('LLLL') }}
          </span>
          <div class="wallet-transaction-summary">
            <span :class="transaction.type == 0 ? 'g-text' : 'p-text'">{{ transactionType(transaction.type) }}</span>
            <span class="font-16">{{ transaction.amount | currency }}</span>
          </div>
          <span class="font-12 grey-text">{{ transactionStatus(transaction.status) }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { parseWalletAmount } from '~/utils/wallet'
import { saveCheckoutContext } from '~/utils/checkout-context'

export default {
  data() {
    return {
      amountOptions: [30000, 50000, 100000], payAmount: '',
      wallet: null, loading: false, charging: false,
      loadError: null, chargeError: null, checkoutInvoice: null
    }
  },
  computed: {
    normalizedAmount() { return parseWalletAmount(this.payAmount) },
    balance() {
      return this.wallet ? this.wallet.balance : this.$store.state.user.user.balance
    },
    transactions() {
      return this.wallet && Array.isArray(this.wallet.invoice)
        ? [...this.wallet.invoice].sort((first, second) => second.pk - first.pk) : []
    }
  },
  methods: {
    transactionType(type) {
      return { '0': 'افزایش موجودی', '1': 'کسر از موجودی', '2': 'تسویه حساب' }[type] || 'تراکنش'
    },
    transactionStatus(status) {
      return { '0': 'پرداخت شده', '1': 'در انتظار پرداخت', '2': 'در حال پرداخت',
        '3': 'ناموفق', '4': 'ثبت شده', '5': 'بازپرداخت شده' }[status] || 'وضعیت نامشخص'
    },
    async loadWallet() {
      this.loading = true
      this.loadError = null
      try {
        const response = await this.$api.$get('/v1/user-profile/wallet/')
        this.wallet = response.wallet
      } catch (error) {
        this.loadError = 'دریافت تراکنش‌ها انجام نشد. لطفاً دوباره تلاش کنید.'
      } finally {
        this.loading = false
      }
    },
    async chargeWallet() {
      if (this.charging) return
      const amount = parseWalletAmount(this.payAmount)
      if (!amount) {
        this.chargeError = 'مبلغ معتبر وارد کنید.'
        return
      }
      this.charging = true
      this.chargeError = null
      try {
        if (!this.checkoutInvoice || this.checkoutInvoice.amount !== amount) {
          this.checkoutInvoice = await this.$api.$post('/v1/user-profile/wallet/charge/', { amount })
        }
        const invoice = this.checkoutInvoice.uuid
        const checkout = await this.$api.$get(`/v1/payment/make/${invoice}/`)
        saveCheckoutContext(window.sessionStorage, { invoice, kind: 'wallet' })
        window.location.assign(checkout.redirect_to)
      } catch (error) {
        this.chargeError = 'شروع پرداخت انجام نشد. لطفاً دوباره تلاش کنید.'
      } finally {
        this.charging = false
      }
    }
  },
  mounted() { this.loadWallet() }
}
</script>

<style scoped lang="sass">
.wallet-page
  padding-bottom: 24px
.wallet-back
  background: transparent
  border: 0
  cursor: pointer
.wallet-amount-options
  display: flex
  flex-wrap: wrap
  gap: 8px
  button
    flex: 1 1 80px
    border: 1px solid currentColor
    border-radius: 5px
    padding: 10px 6px
    cursor: pointer
    &[aria-pressed="true"]
      box-shadow: inset 0 0 0 1px currentColor
.wallet-error
  color: #b01b32
.wallet-transaction
  display: flex
  flex-direction: column
  gap: 6px
.wallet-transaction-summary
  display: flex
  justify-content: space-between
  flex-wrap: wrap
  gap: 8px
@media (max-width: 360px)
  .profile-info-bar .header
    font-size: 15px
</style>
