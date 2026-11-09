<template>
  <main class="transfer-page" dir="rtl">
    <nuxt-link :to="localePath('/user/home')" class="back-link">بازگشت به سفارش</nuxt-link>
    <p v-if="loading" role="status">در حال دریافت اطلاعات پرداخت…</p>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <button v-if="!transfer && !loading" class="primary" @click="load()">تلاش دوباره</button>
    <template v-if="transfer">
      <section v-if="transfer.status === 'draft'" class="payment-card">
        <span class="eyebrow">کارت‌به‌کارت · سفارش {{ transfer.join }}</span>
        <h1>واریز کنید، رسید را بفرستید</h1>
        <p>با ارسال رسید، سفارش شما خودکار ثبت می‌شود و مجموعه می‌تواند آماده‌سازی را شروع کند.</p>
        <p class="notice">اگر قبلاً واریز کرده‌اید، دوباره پول نفرستید؛ فقط رسید درست همان پرداخت را انتخاب کنید.</p>
        <div class="amount">
          <strong>{{ money(transfer.amount) }} <small>تومان</small></strong>
          <button type="button" class="copy" @click="copy(String(transfer.amount * 10), 'مبلغ ریالی')">کپی مبلغ ریالی</button>
          <span>{{ money(transfer.amount * 10) }} ریال</span>
        </div>
        <div class="destination">
          <span>شماره کارت مقصد</span>
          <strong dir="ltr">{{ formattedCard }}</strong>
          <span>{{ transfer.destination_holder }}</span>
          <button type="button" class="copy" @click="copy(transfer.destination_card, 'شماره کارت')">کپی شماره کارت</button>
        </div>
        <p class="hint">در اپ بانکی، نام صاحب کارت و مبلغ را بررسی کنید. پس از واریز، تصویر رسید را انتخاب کنید.</p>
        <label class="upload" :class="{ disabled: uploading }">
          <input ref="file" type="file" accept="image/png,image/jpeg,image/webp" :disabled="uploading" @change="chooseReceipt">
          {{ uploading ? 'در حال ارسال رسید…' : 'انتخاب رسید و ثبت سفارش' }}
        </label>
        <span class="hint">PNG، JPG یا WebP · حداکثر ۸ مگابایت</span>
        <div v-if="uploading" role="status" aria-live="polite">
          <progress :value="progress" max="100">{{ progress }}٪</progress>
          <p>{{ progress < 100 ? progress + '٪ ارسال شد' : 'در حال ثبت سفارش…' }}</p>
        </div>
        <img v-if="preview" :src="preview" class="receipt-preview" alt="پیش‌نمایش رسید انتخاب‌شده">
        <button v-if="selectedFile && error && !uploading" class="primary" @click="uploadReceipt">ارسال دوباره همین رسید</button>
        <button v-if="quoteChanged && !uploading" class="copy" @click="restart">دریافت مبلغ به‌روز سفارش</button>
      </section>
      <section v-else-if="['submitted', 'confirmed'].includes(transfer.status)" class="payment-card success" aria-live="polite">
        <span class="success-icon" aria-hidden="true">✓</span>
        <h1>سفارش شما ثبت شد</h1>
        <p>رسید دریافت شد. برای ادامه سفارش نیازی به منتظر ماندن در این صفحه نیست.</p>
        <div class="notice">{{ transfer.status === 'confirmed' ? 'مجموعه دریافت وجه را تأیید کرده است.' : 'رسید ثبت شده است؛ دریافت وجه هنوز توسط مجموعه تأیید نشده است.' }}</div>
        <strong>{{ money(transfer.amount) }} تومان · سفارش {{ transfer.join }}</strong>
        <nuxt-link :to="trackingPath" class="primary">پیگیری آماده‌سازی سفارش</nuxt-link>
      </section>
      <section v-else class="payment-card">
        <h1>{{ transfer.status === 'rejected' ? 'رسید نیاز به اصلاح دارد' : 'اطلاعات سفارش تغییر کرده است' }}</h1>
        <p>{{ transfer.review_note || 'قبل از ادامه، مبلغ به‌روز سفارش را بررسی کنید.' }}</p>
        <p class="notice">اگر وجه را انتقال داده‌اید دوباره واریز نکنید؛ رسید درست را ارسال کنید یا با مجموعه تماس بگیرید.</p>
        <button class="primary" :disabled="uploading" @click="restart">ادامه و ارسال رسید درست</button>
      </section>
      <p class="hint">رسید فقط برای شما و کارکنان این مجموعه قابل مشاهده است.</p>
    </template>
    <p class="copy-status" role="status" aria-live="polite">{{ copied }}</p>
  </main>
</template>

<script>
export default {
  data() {
    return { transfer: null, loading: true, uploading: false, progress: 0, error: '',
      copied: '', selectedFile: null, preview: '', quoteChanged: false, poll: null, fetching: false }
  },
  computed: {
    formattedCard() { return (this.transfer.destination_card || '').replace(/(.{4})(?=.)/g, '$1 ') },
    trackingPath() {
      return this.localePath(this.transfer.table_uuid ? '/user/liveorder/' + this.transfer.table_uuid : '/user/home')
    }
  },
  mounted() {
    this.load()
    this.poll = setInterval(() => {
      if (this.transfer && this.transfer.status === 'submitted' && !document.hidden) this.load(true)
    }, 15000)
  },
  beforeDestroy() {
    clearInterval(this.poll)
    if (this.preview) URL.revokeObjectURL(this.preview)
  },
  methods: {
    money(amount) { return Number(amount).toLocaleString('fa-IR') },
    message(error) {
      const data = error.response && error.response.data
      return (data && (data.detail || data[0] || (data.non_field_errors && data.non_field_errors[0]))) ||
        'ارتباط برقرار نشد. اگر واریز کرده‌اید دوباره پول نفرستید؛ ارسال رسید را دوباره امتحان کنید.'
    },
    setTransfer(transfer) {
      this.transfer = transfer
      this.$store.commit('table/setCardTransfer', transfer)
    },
    async load(quiet = false) {
      if (this.fetching) return
      this.fetching = true
      if (!quiet) { this.loading = true; this.error = '' }
      try {
        this.setTransfer(await this.$nonBlockingApi.$get(`v1/card-transfers/${this.$route.params.id}/`))
      } catch (error) {
        if (!quiet) this.error = this.message(error)
      } finally { this.loading = false; this.fetching = false }
    },
    async copy(value, label) {
      this.copied = ''
      try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value)
        else {
          const input = document.createElement('textarea')
          input.value = value
          input.style.position = 'fixed'
          input.style.opacity = '0'
          document.body.appendChild(input)
          input.select()
          const ok = document.execCommand('copy')
          input.remove()
          if (!ok) throw new Error('copy')
        }
        this.copied = label + ' کپی شد'
      } catch (error) { this.copied = 'کپی نشد؛ شماره یا مبلغ را دستی انتخاب و کپی کنید.' }
    },
    chooseReceipt(event) {
      const file = event.target.files[0]
      if (!file) return
      this.error = ''
      if (file.size > 8 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        this.error = 'یک تصویر PNG، JPG یا WebP با حجم حداکثر ۸ مگابایت انتخاب کنید.'
        event.target.value = ''
        return
      }
      if (this.preview) URL.revokeObjectURL(this.preview)
      this.preview = URL.createObjectURL(file)
      this.selectedFile = file
      this.uploadReceipt()
    },
    completeSubmission(transfer) {
      this.setTransfer(transfer)
      this.selectedFile = null
      if (this.preview) URL.revokeObjectURL(this.preview)
      this.preview = ''
    },
    async uploadReceipt() {
      if (this.uploading || !this.selectedFile) return
      this.uploading = true
      this.error = ''
      this.progress = 0
      this.quoteChanged = false
      const data = new FormData()
      data.append('receipt', this.selectedFile)
      try {
        const transfer = await this.$nonBlockingApi.$post(`v1/card-transfers/${this.transfer.uuid}/receipt/`, data, {
          onUploadProgress: event => { if (event.total) this.progress = Math.round(event.loaded * 100 / event.total) }
        })
        this.completeSubmission(transfer)
      } catch (error) {
        if (!error.response) {
          try {
            const saved = await this.$nonBlockingApi.$get(`v1/card-transfers/${this.transfer.uuid}/`)
            if (['submitted', 'confirmed', 'rejected'].includes(saved.status)) {
              this.completeSubmission(saved)
              return
            }
          } catch (readError) { /* Keep the file available for retry while offline. */ }
        }
        this.error = this.message(error)
        this.quoteChanged = !!(error.response && error.response.status === 409)
      } finally { this.uploading = false }
    },
    async restart() {
      if (this.uploading) return
      this.uploading = true
      this.error = ''
      try {
        const transfer = await this.$nonBlockingApi.$post(`v1/join/${this.transfer.join}/card-transfer/`)
        this.setTransfer(transfer)
        this.quoteChanged = false
        if (String(this.$route.params.id) !== transfer.uuid) {
          await this.$router.replace(this.localePath('/user/card-transfer/' + transfer.uuid))
        }
      } catch (error) { this.error = this.message(error) }
      finally { this.uploading = false }
    }
  }
}
</script>

<style scoped>
.transfer-page { max-width: 560px; margin: 0 auto; padding: 24px 18px 100px; color: #172b3a; }
.back-link { display: inline-block; margin-bottom: 22px; color: #315d6a; }
.payment-card { border: 1px solid #dce5e7; border-radius: 24px; background: white; padding: 24px; box-shadow: 0 12px 36px #163e4810; }
h1 { font-size: 24px; font-weight: 800; margin: 12px 0; line-height: 1.65; }
p { line-height: 1.9; }
.eyebrow, .hint { color: #506575; font-size: 13px; }
.hint { display: block; margin: 14px 0; line-height: 1.9; }
.amount { display: grid; gap: 10px; padding: 22px 0; border-bottom: 1px solid #e1e9ec; }
.amount strong { font-size: 28px; }
.amount small { font-size: 16px; }
.destination { display: grid; gap: 12px; padding: 22px 0; }
.destination strong { font: 700 24px monospace; letter-spacing: 1px; text-align: right; user-select: all; }
.copy { border: 1px solid #97bcb8; border-radius: 10px; color: #075b51; background: #f2faf8; padding: 10px 16px; cursor: pointer; justify-self: start; font: inherit; }
.primary, .upload { display: block; width: 100%; border: 0; border-radius: 14px; background: #076a5b; color: white; padding: 16px; text-align: center; font: inherit; font-weight: bold; cursor: pointer; margin-top: 18px; }
.upload { position: relative; overflow: hidden; }
.upload input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.upload:focus-within, button:focus-visible { outline: 3px solid #298cdd; outline-offset: 3px; }
.disabled, button:disabled { opacity: .65; cursor: wait; }
.notice { border-radius: 12px; padding: 14px; margin: 18px 0; background: #edf5f4; line-height: 1.9; }
.error { background: #fff0ed; color: #9f2d1d; }
.receipt-preview { display: block; max-width: 100%; max-height: 260px; border-radius: 12px; margin: 16px auto; }
progress { width: 100%; accent-color: #076a5b; margin-top: 18px; }
.success { text-align: center; }
.success-icon { display: inline-grid; place-items: center; width: 64px; height: 64px; border-radius: 50%; color: #076a5b; background: #dff5ec; font-size: 34px; }
.copy-status { min-height: 28px; color: #075b51; }
@media(max-width: 360px) { .payment-card { padding: 18px; } .destination strong { font-size: 20px; } }
</style>
