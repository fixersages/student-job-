<script setup>
import { computed, ref, watch } from 'vue'
import { getAvatarImageSrc } from '@/lib/avatar'

const props = defineProps({
  /** 他人头像公链（来自 campus_public_profiles 等），优先于本地生成图 */
  customAvatarUrl: { type: String, default: '' },
  /** Supabase User 或含 user_metadata / email / id 的对象 */
  user: { type: Object, default: null },
  /** 本地演示用户（可选 avatar_url） */
  legacyUser: { type: Object, default: null },
  /** 仅有 uuid 时生成对方默认头像 */
  seedUserId: { type: String, default: '' },
  /** Tailwind 尺寸类，如 h-9 w-9 */
  sizeClass: { type: String, default: 'h-10 w-10' },
  /** 额外 class 加在外层 span */
  wrapperClass: { type: String, default: '' },
  /** 描边（导航栏深色底用浅色环） */
  ringClass: { type: String, default: 'ring-2 ring-slate-200/80' },
})

const bust = ref(0)
watch(
  () => props.user?.user_metadata?.avatar_url,
  () => {
    bust.value += 1
  },
)

watch(
  () => props.customAvatarUrl,
  () => {
    bust.value += 1
  },
)

const imgBroken = ref(false)
watch(
  () => [props.customAvatarUrl, props.user?.user_metadata?.avatar_url, props.seedUserId, props.legacyUser?.avatar_url],
  () => {
    imgBroken.value = false
  },
)

const baseSrc = computed(() => {
  const custom = String(props.customAvatarUrl || '').trim()
  if (!imgBroken.value && /^https?:\/\//i.test(custom)) {
    return custom
  }
  return getAvatarImageSrc({
    user: props.user,
    legacyUser: props.legacyUser,
    seedUserId: props.seedUserId,
    generatedOnly: imgBroken.value,
  })
})

const displaySrc = computed(() => {
  const u = baseSrc.value
  if (!u || u.startsWith('data:')) return u
  const sep = u.includes('?') ? '&' : '?'
  return `${u}${sep}t=${bust.value}`
})

const altText = computed(() => {
  const nick = props.user?.user_metadata?.nickname || props.legacyUser?.nickname
  const em = props.user?.email || props.legacyUser?.email
  return nick || (em ? String(em).split('@')[0] : '用户头像')
})

function onImgError() {
  imgBroken.value = true
}
</script>

<template>
  <span
    class="inline-flex shrink-0 overflow-hidden rounded-full bg-slate-200/80"
    :class="[sizeClass, wrapperClass, ringClass]"
    role="img"
    :aria-label="altText"
  >
    <img
      :src="displaySrc"
      :alt="altText"
      width="96"
      height="96"
      class="h-full w-full object-cover"
      decoding="async"
      loading="lazy"
      @error="onImgError"
    />
  </span>
</template>
