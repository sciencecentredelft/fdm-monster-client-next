<template>
  <v-card v-if="locked" class="ma-4 pa-6" max-width="520">
    <v-card-title><v-icon start>lock</v-icon>{{ floor?.name }}: Locked grid view</v-card-title>
    <v-card-text>
      <p class="mb-3">Enter this group's password to open its grid view.</p>
      <v-form @submit.prevent="unlock">
        <v-text-field
          v-model="password"
          type="password"
          label="Group password"
          autocomplete="off"
          :disabled="checking"
        />
        <v-alert v-if="errorMessage" type="warning" variant="tonal" class="mb-3">{{ errorMessage }}</v-alert>
        <v-btn type="submit" color="primary" :loading="checking" :disabled="checking || !password">Open grid</v-btn>
      </v-form>
      <p class="text-caption mt-4">This is a convenience lock, not an access restriction on the printers elsewhere.</p>
    </v-card-text>
  </v-card>
  <template v-else>
    <v-btn v-if="protectedView && !profileStore.isAdmin" class="ma-2" prepend-icon="lock" @click="lock">
      Lock grid view
    </v-btn>
    <slot />
  </template>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { FloorService } from '@/backend/floor.service'
import { useFloorStore } from '@/store/floor.store'
import { useSettingsStore } from '@/store/settings.store'
import { useProfileStore } from '@/store/profile.store'

const emit = defineEmits<{ 'update:locked': [locked: boolean] }>()
const floorStore = useFloorStore()
const settingsStore = useSettingsStore()
const profileStore = useProfileStore()
const floor = computed(() => floorStore.selectedFloor)
const protectedView = computed(() => !!(settingsStore.serverSettings?.floorGridLockEnabled && floor.value?.gridProtected))
const granted = ref(false)
const password = ref('')
const checking = ref(false)
const errorMessage = ref('')
let requestVersion = 0
const locked = computed(() => protectedView.value && !profileStore.isAdmin && !granted.value)

function lock() {
  requestVersion++
  granted.value = false
  password.value = ''
  checking.value = false
  errorMessage.value = ''
}

watch([
  () => floor.value?.id,
  () => floor.value?.gridLockVersion,
  protectedView,
  () => profileStore.userId,
  () => profileStore.isAdmin
], lock, { flush: 'sync' })
watch(locked, value => emit('update:locked', value), { immediate: true, flush: 'sync' })

async function unlock() {
  if (!floor.value || checking.value || !password.value) return
  const version = ++requestVersion
  const target = { id: floor.value.id, lockVersion: floor.value.gridLockVersion }
  checking.value = true
  errorMessage.value = ''
  try {
    const result = await FloorService.unlockGrid(target.id, password.value)
    if (version !== requestVersion) return
    if (!result.unlocked) {
      errorMessage.value = 'Incorrect group password. Please try again.'
    } else if (result.gridLockVersion !== target.lockVersion) {
      errorMessage.value = 'The group password has changed. Please try again.'
      await floorStore.loadFloors()
    } else {
      granted.value = true
      password.value = ''
    }
  } catch (error) {
    if (version !== requestVersion) return
    console.error('Failed to unlock floor grid:', error)
    errorMessage.value = 'Could not unlock the grid. Check the connection, or wait a minute if you have tried several passwords.'
  } finally {
    if (version === requestVersion) checking.value = false
  }
}

onBeforeUnmount(() => { requestVersion++ })
</script>
