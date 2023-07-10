/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import Vue from "vue";
import Home from "./components/Home.vue";
import vuetify from '@/plugins/vuetify'

Vue.config.productionTip = false;

new Vue({
  vuetify,
  render: function (h) { return h(Home); },
}).$mount("#app");
