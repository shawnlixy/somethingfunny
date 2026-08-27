<template>
  <router-view />
</template>

<script setup>
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
}

html.pet-window,
html.pet-window body,
html.pet-window #app {
  background: transparent;
}
</style>
