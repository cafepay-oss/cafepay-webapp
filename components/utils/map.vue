<template>
  <div id="map" class="map-container">
    
  </div>
</template>

<script>
if (process.browser) {
window.L = require('@/node_modules/leaflet/dist/leaflet.js')
} 
// window.L = require('@/node_modules/leaflet/dist/leaflet.js')
  export default {
    props: {
      'cordinateX': 0, 'cordinateY': 0,
      mapZoom: {
        type: Number,
        default: 17
      },
      cafeName: {
        default: ''
      },
      isActive: {
        default: false
      }
      
    },
    data() {
      return {
        initial: false
      }
    },
    beforeMount(){

    },
    mounted(){

    },
    watch: {
      isActive(newValue, oldValue) {
        if (newValue && !this.initial) {
          this.initial = true
          var map = L.map('map').setView([this.cordinateX, this.cordinateY], this.mapZoom)
          L.tileLayer(this.$config.CAFEPAY_WEBAPP_MAP_TILE_URL, {
            maxZoom: 19,
            attribution: this.$config.CAFEPAY_WEBAPP_MAP_ATTRIBUTION
          }).addTo(map)
          var marker = L.marker([this.cordinateX, this.cordinateY]).addTo(map)
          marker.bindPopup('<b style="font-weight:500;">' + this.cafeName + '</b>').openPopup()
        }
      },
    },
  }
</script>

<style scoped lang="sass">
.map-container
  z-index: 100
  position: absolute
  top: 0
  right: 0
  left: 0
  bottom: 0


  
</style>