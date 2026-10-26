<template>
  <div>
    <v-row no-gutters>
      <v-navigation-drawer :permanent="true">
        <v-list
          density="compact"
          nav
        >
          <v-list-item
            v-for="item in visibleItems"
            :key="item.title"
            :to="item.path"
            link
            :prepend-icon="item.icon"
            :title="item.title"
            router-link
            :style="item.divider ? 'border-bottom: 1px solid gray' : ''"
          />
        </v-list>
      </v-navigation-drawer>

      <v-col>
        <router-view v-if="profileStore.isAdmin || personalSettingsPaths.has(route.path)" />
        <v-alert v-else type="warning" variant="tonal">Administrator access is required to change server settings.</v-alert>
      </v-col>
    </v-row>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue'
import { personalSettingsPaths, settingsPage } from '@/router/setting.constants'
import { useRoute } from 'vue-router'
import { useProfileStore } from '@/store/profile.store'

const profileStore = useProfileStore()
const route = useRoute()

// Make sure we have profile info to drive admin-only filtering.
onMounted(async () => {
  if (!profileStore.userId) {
    try {
      await profileStore.getProfile()
    } catch (error) {
      console.error('Failed to load profile for settings nav:', error)
    }
  }
})

const visibleItems = computed(() => Object.values(settingsPage).filter(
  item => profileStore.isAdmin || personalSettingsPaths.has(item.path)
))
</script>
