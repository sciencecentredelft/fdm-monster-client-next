<template>
  <v-list
    subheader
    three-line
  >
    <v-list-subheader>
      <v-btn
        v-if="collapsible"
        variant="text"
        class="px-0"
        :aria-expanded="expanded"
        :append-icon="expanded ? 'expand_less' : 'expand_more'"
        @click="expanded = !expanded"
      >{{ props.title }}</v-btn>
      <span v-else class="pr-3">
        {{ props.title }}
      </span>

      <v-tooltip
        bottom
        v-if="props.tooltip?.length"
      >
        <template v-slot:activator="{ props }">
          <v-icon
            class="help-icon"
            v-bind="props"
            >help_outline</v-icon
          >
        </template>
        <span class="tooltip-content">
          {{ tooltip }}
        </span>
      </v-tooltip>
    </v-list-subheader>
    <v-list-item v-show="!collapsible || expanded" data-setting-content>
      <v-row v-if="usecols">
        <v-col cols="4">
          <slot></slot>
        </v-col>
      </v-row>
      <slot v-else></slot>
    </v-list-item>
  </v-list>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const expanded = ref(true)
const props = withDefaults(defineProps<{
  title: string
  tooltip?: string
  usecols?: boolean
  collapsible?: boolean
}>(), {
  usecols: true
})
</script>
