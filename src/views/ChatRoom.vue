<script setup>
/**
 * Realtime：仅用 realtimeChannel（ref）保存 channel，stopRealtime() / onUnmounted 中 supabase.removeChannel 彻底销毁。
 * 请求：loadConversation / loadInitialMessages / loadOlder / send / mark / readStates 全部 try/catch，错误只 console，不 alert 阻塞。
 * 已读：进房先 flushMarkRead('enter') 用「本机时间 + 缓冲」写水位，避免慢时钟；消息加载后再 syncMessages 对齐 DB 的 created_at。
 * 防重：appendMessage 内 seenIds + 再次校验 id；离开页面 pageDestroyed 后不再 push、不再处理 Realtime。
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { supabase } from '@/lib/supabase'
import UserAvatar from '@/components/UserAvatar.vue'
import {
  fetchConversationById,
  fetchMessages,
  sendTextMessage,
  sendFileMessage,
  uploadResumeFile,
  markConversationRead,
  fetchConversationReadStates,
} from '@/api/chat'

const route = useRoute()

const conversationId = computed(() => String(route.params.conversationId || ''))

const conv = ref(null)
const convError = ref('')
const loadingConv = ref(true)

const messages = ref([])
const loadingMessages = ref(true)
const loadMoreLoading = ref(false)
const hasMore = ref(true)
const PAGE = 50

const myUid = ref('')
/** 当前登录用户完整对象（用于消息气泡展示本人上传的头像） */
const myUser = ref(null)
const input = ref('')
const sending = ref(false)
const uploading = ref(false)
/** 最近一次简历/附件发送失败原因（便于排查 Storage 或 DB） */
const lastFileError = ref('')
const bottomEl = ref(null)
const scrollEl = ref(null)
const fileInputRef = ref(null)

/** 已出现过的消息 id，防 Realtime + 本地双写重复 */
const seenIds = new Set()

const readStates = ref({})

/** 组件已卸载：禁止任何异步回调再改状态 / 再订阅 */
const pageDestroyed = ref(false)

/** 【必须】全局唯一 Realtime channel 引用，仅此处持有，便于 removeChannel */
const realtimeChannel = ref(null)

let markReadTimer = 0
let authListener = null

function clearMarkReadTimer() {
  window.clearTimeout(markReadTimer)
  markReadTimer = 0
}

/**
 * 【监听销毁】离开页面或切换会话前：removeChannel + 清空引用 + 停止已读防抖
 * 保证离开后 Realtime 完全停止。
 */
function stopRealtime() {
  clearMarkReadTimer()
  const ch = realtimeChannel.value
  if (ch) {
    try {
      supabase.removeChannel(ch)
    } catch (e) {
      console.error('[ChatRoom] stopRealtime removeChannel', e)
    }
    realtimeChannel.value = null
  }
}

async function loadReadStates() {
  if (pageDestroyed.value) return
  const id = String(conversationId.value || '').trim()
  if (!id || !conv.value) return
  try {
    const { data, error } = await fetchConversationReadStates(id)
    if (pageDestroyed.value) return
    if (error) {
      console.warn('[ChatRoom] loadReadStates', error)
      return
    }
    const next = {}
    for (const r of data ?? []) {
      if (r?.user_id) next[r.user_id] = r.last_read_at
    }
    readStates.value = next
  } catch (e) {
    console.warn('[ChatRoom] loadReadStates', e)
  }
}

function showReadReceipt(m) {
  if (!m?.id || m.sender_id !== myUid.value) return false
  const c = conv.value
  if (!c || !myUid.value) return false
  const otherId = myUid.value === c.seeker_id ? c.recruiter_id : c.seeker_id
  const otherRead = readStates.value[otherId]
  if (!otherRead) return false
  const tOther = new Date(otherRead).getTime()
  const tMsg = new Date(m.created_at).getTime()
  if (Number.isNaN(tOther) || Number.isNaN(tMsg) || tOther < tMsg) return false
  const list = messages.value
  let anchor = null
  for (let i = list.length - 1; i >= 0; i--) {
    const x = list[i]
    if (x.sender_id !== myUid.value) continue
    const tx = new Date(x.created_at).getTime()
    if (!Number.isNaN(tx) && tOther >= tx) {
      anchor = x
      break
    }
  }
  return anchor?.id === m.id
}

function formatMsgTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** @returns {'image'|'pdf'|'other'} */
function fileMessageKind(m) {
  const mime = String(m?.file_mime || '').toLowerCase()
  const name = String(m?.file_name || '').toLowerCase()
  if (mime.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/i.test(name)) return 'image'
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  return 'other'
}

function openChatFileUrl(url) {
  const u = String(url || '').trim()
  if (!u) return
  try {
    window.open(u, '_blank', 'noopener,noreferrer')
  } catch (e) {
    console.warn('[ChatRoom] openChatFileUrl', e)
  }
}

/** 与微信类似：441.2K / 1.2M；无记录时返回空串 */
function formatStoredFileSize(bytes) {
  if (bytes == null || bytes === '') return ''
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return ''
  if (n < 1024) return `${Math.round(n)}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}K`
  return `${(n / (1024 * 1024)).toFixed(1)}M`
}

const otherName = computed(() => {
  const c = conv.value
  const uid = myUid.value
  if (!c || !uid) return '对方'
  return uid === c.seeker_id ? c.employer_display_name || '招聘方' : c.seeker_display_name || '求职者'
})

const jobTitle = computed(() => {
  const j = conv.value?.jobs
  if (j && typeof j === 'object' && 'title' in j) return j.title || '岗位'
  return '岗位'
})

const otherPartyId = computed(() => {
  const c = conv.value
  const uid = myUid.value
  if (!c || !uid) return ''
  return uid === c.seeker_id ? String(c.recruiter_id || '') : String(c.seeker_id || '')
})

const otherPartyPublicProfile = computed(() => {
  const c = conv.value
  const uid = myUid.value
  if (!c || !uid) return null
  return uid === c.seeker_id ? c.recruiter_public : c.seeker_public
})

const otherPartyAvatarUrl = computed(() => {
  const u = otherPartyPublicProfile.value?.avatar_url
  return u != null && String(u).trim() && /^https?:\/\//i.test(String(u).trim()) ? String(u).trim() : ''
})

function senderPublicAvatarUrl(senderId) {
  const id = String(senderId || '')
  const c = conv.value
  if (!id || !c) return ''
  if (id === String(c.recruiter_id ?? '')) {
    const u = c.recruiter_public?.avatar_url
    return u != null && String(u).trim() && /^https?:\/\//i.test(String(u).trim()) ? String(u).trim() : ''
  }
  if (id === String(c.seeker_id ?? '')) {
    const u = c.seeker_public?.avatar_url
    return u != null && String(u).trim() && /^https?:\/\//i.test(String(u).trim()) ? String(u).trim() : ''
  }
  return ''
}

async function scrollToBottom() {
  if (pageDestroyed.value) return
  try {
    await nextTick()
    const el = scrollEl.value
    if (el) {
      el.scrollTop = el.scrollHeight
      return
    }
    bottomEl.value?.scrollIntoView?.({ behavior: 'smooth' })
  } catch (e) {
    console.warn('[ChatRoom] scrollToBottom', e)
  }
}

function mergeSeen(rows) {
  for (const m of rows) {
    if (m?.id) seenIds.add(m.id)
  }
}

async function loadConversation() {
  const id = conversationId.value
  if (!id) {
    convError.value = '无效的会话'
    conv.value = null
    loadingConv.value = false
    return
  }
  loadingConv.value = true
  convError.value = ''
  try {
    let user = null
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      user = session?.user ?? null
      if (!user) {
        const {
          data: { user: u },
        } = await supabase.auth.getUser()
        user = u
      }
    } catch (e) {
      console.warn('[ChatRoom] loadConversation getSession', e)
    }
    if (pageDestroyed.value) return
    myUid.value = user?.id ?? ''
    myUser.value = user ?? null
    if (!user?.id) {
      convError.value = '请先登录'
      conv.value = null
      return
    }

    let data = null
    let error = null
    try {
      const res = await fetchConversationById(id)
      data = res.data
      error = res.error
    } catch (e) {
      console.error('[ChatRoom] fetchConversationById', e)
      error = e
    }
    if (pageDestroyed.value) return
    if (error || !data) {
      convError.value = error?.message || '无法加载会话'
      conv.value = null
      return
    }
    if (data.seeker_id !== user.id && data.recruiter_id !== user.id) {
      convError.value = '无权查看此会话'
      conv.value = null
      return
    }
    conv.value = data
  } catch (e) {
    console.error('[ChatRoom] loadConversation', e)
    convError.value = '加载异常'
    conv.value = null
  } finally {
    if (!pageDestroyed.value) loadingConv.value = false
  }
}

async function loadInitialMessages() {
  const id = conversationId.value
  if (!id || !conv.value || pageDestroyed.value) return
  loadingMessages.value = true
  hasMore.value = true
  seenIds.clear()
  try {
    let data = null
    let error = null
    try {
      const res = await fetchMessages(id, { limit: PAGE })
      data = res.data
      error = res.error
    } catch (e) {
      console.error('[ChatRoom] fetchMessages', e)
      error = e
    }
    if (pageDestroyed.value) return
    loadingMessages.value = false
    if (error) {
      messages.value = []
      console.warn('[ChatRoom] loadInitialMessages', error)
      try {
        await flushMarkRead('enter')
      } catch (e) {
        console.warn('[ChatRoom] flushMarkRead after load error', e)
      }
      return
    }
    const rows = data ?? []
    messages.value = rows
    mergeSeen(rows)
    hasMore.value = rows.length >= PAGE
    await scrollToBottom()
    try {
      await loadReadStates()
    } catch (e) {
      console.warn('[ChatRoom] loadReadStates after initial', e)
    }
    try {
      await flushMarkRead('syncMessages')
    } catch (e) {
      console.warn('[ChatRoom] flushMarkRead syncMessages after initial', e)
    }
  } catch (e) {
    console.error('[ChatRoom] loadInitialMessages', e)
    loadingMessages.value = false
    messages.value = []
    try {
      await flushMarkRead('enter')
    } catch (e2) {
      console.warn('[ChatRoom] flushMarkRead after load exception', e2)
    }
  }
}

async function loadOlder() {
  const id = conversationId.value
  if (!id || !messages.value.length || loadMoreLoading.value || !hasMore.value || pageDestroyed.value) return
  const first = messages.value[0]
  if (!first?.created_at) return
  loadMoreLoading.value = true
  const el = scrollEl.value
  const prevH = el?.scrollHeight ?? 0
  const prevTop = el?.scrollTop ?? 0
  try {
    let data = null
    let error = null
    try {
      const res = await fetchMessages(id, { before: first.created_at, limit: PAGE })
      data = res.data
      error = res.error
    } catch (e) {
      console.error('[ChatRoom] fetchMessages loadOlder', e)
      error = e
    }
    if (pageDestroyed.value) return
    if (error) {
      console.warn('[ChatRoom] loadOlder', error)
      return
    }
    if (!data?.length) {
      hasMore.value = false
      return
    }
    const older = data.filter((m) => m.id && !seenIds.has(m.id))
    for (const m of older) seenIds.add(m.id)
    messages.value = [...older, ...messages.value]
    hasMore.value = data.length >= PAGE
    await nextTick()
    if (el && !pageDestroyed.value) {
      el.scrollTop = el.scrollHeight - prevH + prevTop
    }
  } catch (e) {
    console.error('[ChatRoom] loadOlder', e)
  } finally {
    if (!pageDestroyed.value) loadMoreLoading.value = false
  }
}

async function sendText() {
  const id = String(conv.value?.id || conversationId.value || '').trim()
  if (!id || !conv.value || sending.value || pageDestroyed.value) return
  sending.value = true
  try {
    const draft = input.value
    let data = null
    let error = null
    try {
      const res = await sendTextMessage(id, draft)
      data = res.data
      error = res.error
    } catch (e) {
      console.error('[ChatRoom] sendTextMessage', e)
      error = e
    }
    if (pageDestroyed.value) return
    if (error) {
      console.warn('[ChatRoom] sendText failed', error)
      return
    }
    if (data?.id) appendMessage(data)
    input.value = ''
    await scrollToBottom()
    try {
      await flushMarkRead()
    } catch (e) {
      console.warn('[ChatRoom] flushMarkRead after sendText', e)
    }
  } catch (e) {
    console.error('[ChatRoom] sendText', e)
  } finally {
    if (!pageDestroyed.value) sending.value = false
  }
}

function pickFile() {
  fileInputRef.value?.click?.()
}

function formatChatFileError(err) {
  if (!err) return '发送失败'
  const msg = String(err.message ?? err).trim()
  if (msg) return msg
  try {
    return JSON.stringify(err)
  } catch {
    return '发送失败'
  }
}

async function onFileChange(e) {
  const file = e.target?.files?.[0]
  e.target.value = ''
  if (!file || pageDestroyed.value) return
  const id = String(conv.value?.id || conversationId.value || '').trim()
  if (!id || !conv.value || uploading.value) return
  lastFileError.value = ''
  uploading.value = true
  try {
    let publicUrl = null
    let upErr = null
    try {
      const up = await uploadResumeFile(file)
      publicUrl = up.publicUrl
      upErr = up.error
    } catch (e) {
      console.error('[ChatRoom] uploadResumeFile', e)
      upErr = e
    }
    if (pageDestroyed.value) return
    if (upErr || !publicUrl) {
      console.warn('[ChatRoom] upload failed', upErr)
      lastFileError.value = formatChatFileError(upErr || new Error('上传失败：未返回链接'))
      return
    }
    let msgRow = null
    let msgErr = null
    try {
      const res = await sendFileMessage(id, {
        fileUrl: publicUrl,
        fileName: file.name,
        fileMime: file.type || null,
        fileSizeBytes: file.size,
      })
      msgRow = res.data
      msgErr = res.error
    } catch (e) {
      console.error('[ChatRoom] sendFileMessage', e)
      msgErr = e
    }
    if (pageDestroyed.value) return
    if (msgErr) {
      console.warn('[ChatRoom] send file msg failed', msgErr)
      lastFileError.value = formatChatFileError(msgErr)
      return
    }
    lastFileError.value = ''
    if (msgRow?.id) appendMessage(msgRow)
    await scrollToBottom()
    try {
      await flushMarkRead()
    } catch (e) {
      console.warn('[ChatRoom] flushMarkRead after file', e)
    }
  } catch (e) {
    console.error('[ChatRoom] onFileChange', e)
  } finally {
    if (!pageDestroyed.value) uploading.value = false
  }
}

/**
 * 【防重复】同 id 只追加一次；销毁后不再写入；会话 id 不一致直接丢弃
 */
function appendMessage(row) {
  try {
    if (pageDestroyed.value) return
    if (!row?.id) return
    if (seenIds.has(row.id)) return
    const cid = String(conversationId.value || '').trim()
    if (cid && row.conversation_id && String(row.conversation_id) !== cid) return
    seenIds.add(row.id)
    messages.value = [...messages.value, row]
    void scrollToBottom()
    scheduleMarkRead()
  } catch (e) {
    console.error('[ChatRoom] appendMessage', e)
  }
}

async function flushMarkRead(mode) {
  if (pageDestroyed.value) return
  const id = String(conv.value?.id || conversationId.value || '').trim()
  if (!id || !conv.value) return

  let opts = {}
  if (mode === 'enter') {
    opts = { skewFutureMs: 180_000 }
  } else if (mode === 'syncMessages') {
    opts = { lastReadAt: computeReadWatermarkFromMessages() }
  } else {
    opts =
      messages.value.length > 0
        ? { lastReadAt: computeReadWatermarkFromMessages() }
        : { skewFutureMs: 120_000 }
  }

  try {
    let error = null
    try {
      const res = await markConversationRead(id, opts)
      error = res.error
    } catch (e) {
      console.error('[ChatRoom] markConversationRead', e)
      error = e
    }
    if (pageDestroyed.value) return
    if (error) {
      console.error('[ChatRoom] markConversationRead failed', error)
      return
    }
    await loadReadStates()
  } catch (e) {
    console.warn('[ChatRoom] flushMarkRead', e)
  }
}

/** 已读水位：不早于「本机时间 + 缓冲」，且晚于当前已加载消息里最新的 created_at，避免时钟慢于 DB 导致列表未读不归零 */
function computeReadWatermarkFromMessages() {
  const floorMs = Date.now() + 120_000
  let maxMsgMs = 0
  for (const m of messages.value) {
    const t = new Date(m?.created_at).getTime()
    if (!Number.isNaN(t)) maxMsgMs = Math.max(maxMsgMs, t)
  }
  if (maxMsgMs <= 0) return new Date(floorMs).toISOString()
  return new Date(Math.max(floorMs, maxMsgMs + 3000)).toISOString()
}

function scheduleMarkRead() {
  if (pageDestroyed.value) return
  clearMarkReadTimer()
  markReadTimer = window.setTimeout(() => {
    markReadTimer = 0
    if (pageDestroyed.value) return
    void flushMarkRead()
  }, 450)
}

function subscribeRealtime() {
  const id = String(conversationId.value || '').trim()
  if (!id || !conv.value || pageDestroyed.value) return
  stopRealtime()

  try {
    const unique = `${id}_${Date.now()}`
    const ch = supabase.channel(`chat_room:${unique}`)
    realtimeChannel.value = ch
    ch.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          if (pageDestroyed.value) return
          try {
            const row = payload?.new
            if (row) appendMessage(row)
          } catch (e) {
            console.error('[ChatRoom] realtime messages handler', e)
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversation_reads',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          if (pageDestroyed.value) return
          try {
            const row = payload.new
            if (row?.user_id && row?.last_read_at) {
              readStates.value = { ...readStates.value, [row.user_id]: row.last_read_at }
            }
          } catch (e) {
            console.error('[ChatRoom] realtime reads handler', e)
          }
        },
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED' || status === 'CLOSED') return
        if (err) console.warn('[ChatRoom] realtime subscribe', status, err)
        else console.warn('[ChatRoom] realtime status', status)
      })

  } catch (e) {
    console.error('[ChatRoom] subscribeRealtime', e)
    stopRealtime()
  }
}

watch(
  () => route.params.conversationId,
  async () => {
    stopRealtime()
    messages.value = []
    seenIds.clear()
    readStates.value = {}
    try {
      await loadConversation()
      if (pageDestroyed.value) return
      if (conv.value) {
        try {
          await flushMarkRead('enter')
        } catch (e) {
          console.warn('[ChatRoom] flushMarkRead on enter', e)
        }
        await loadInitialMessages()
        subscribeRealtime()
      }
    } catch (e) {
      console.error('[ChatRoom] watch conversationId', e)
    }
  },
)

onMounted(async () => {
  pageDestroyed.value = false
  try {
    await loadConversation()
    if (pageDestroyed.value) return
    if (conv.value) {
      try {
        await flushMarkRead('enter')
      } catch (e) {
        console.warn('[ChatRoom] flushMarkRead on enter', e)
      }
      await loadInitialMessages()
      subscribeRealtime()
    }
  } catch (e) {
    console.error('[ChatRoom] onMounted', e)
  }
  try {
    const { data } = supabase.auth.onAuthStateChange(() => {
      if (pageDestroyed.value) return
      void supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (pageDestroyed.value) return
        const u = s?.user ?? null
        myUid.value = u?.id ?? ''
        myUser.value = u
      })
    })
    authListener = data.subscription
  } catch (e) {
    console.error('[ChatRoom] onAuthStateChange', e)
  }
})

onUnmounted(() => {
  /** 离开瞬间再写一次已读（不依赖 pageDestroyed），避免快速返回列表时列表先请求、水位尚未落库 */
  const id = String(conv.value?.id || conversationId.value || '').trim()
  if (conv.value && id) {
    void markConversationRead(id, { skewFutureMs: 90_000 }).catch(() => {})
  }
  /** 【监听销毁】离开聊天页：标记销毁 → 停定时器 → removeChannel → 退订 Auth */
  pageDestroyed.value = true
  clearMarkReadTimer()
  stopRealtime()
  try {
    authListener?.unsubscribe?.()
  } catch (e) {
    console.warn('[ChatRoom] auth unsubscribe', e)
  }
  authListener = null
})
</script>

<template>
  <div class="flex min-h-[calc(100dvh-8rem)] flex-col bg-slate-100/90 pb-6 pt-4 sm:pb-10 sm:pt-6">
    <div class="app-container flex max-w-2xl flex-1 flex-col">
      <header
        class="flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-slate-100/90 pb-4"
      >
        <RouterLink
          to="/chat"
          class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200/80 transition hover:bg-slate-50"
          aria-label="返回列表"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </RouterLink>
        <UserAvatar
          v-if="otherPartyId"
          :custom-avatar-url="otherPartyAvatarUrl"
          :seed-user-id="otherPartyId"
          size-class="h-11 w-11"
          ring-class="ring-2 ring-slate-200/90"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate text-base font-semibold text-slate-900">{{ otherName }}</p>
          <p class="truncate text-xs text-slate-500">{{ jobTitle }}</p>
        </div>
      </header>

      <div v-if="loadingConv" class="mt-6 flex flex-1 flex-col gap-3">
        <div class="h-10 w-40 animate-pulse rounded-lg bg-slate-200/80" />
        <div class="flex-1 space-y-3 rounded-[var(--app-radius-xl)] bg-white/60 p-4 ring-1 ring-slate-200/60">
          <div v-for="n in 8" :key="n" class="h-12 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>

      <div
        v-else-if="convError"
        class="mt-8 rounded-[var(--app-radius-lg)] border border-amber-200/90 bg-amber-50 px-4 py-4 text-sm text-amber-950"
      >
        {{ convError }}
        <div class="mt-4 flex flex-wrap gap-2">
          <RouterLink to="/chat" class="app-btn-secondary px-4 py-2 text-sm">返回消息列表</RouterLink>
          <RouterLink to="/list" class="app-btn-primary px-4 py-2 text-sm">职位大厅</RouterLink>
        </div>
      </div>

      <template v-else-if="conv">
        <div
          ref="scrollEl"
          class="mt-3 flex max-h-[min(560px,calc(100dvh-14rem))] min-h-[240px] flex-1 flex-col overflow-y-auto rounded-[var(--app-radius-xl)] bg-white/90 px-3 py-3 ring-1 ring-slate-200/70 sm:px-4"
        >
          <div class="flex justify-center pb-2">
            <button
              v-if="hasMore && messages.length"
              type="button"
              class="text-xs font-medium text-brand-600 underline-offset-2 hover:underline disabled:opacity-50"
              :disabled="loadMoreLoading"
              @click="void loadOlder()"
            >
              {{ loadMoreLoading ? '加载中…' : '加载更早消息' }}
            </button>
          </div>

          <div v-if="loadingMessages" class="flex flex-1 items-center justify-center py-16 text-sm text-slate-500">
            加载消息…
          </div>

          <ul v-else class="flex flex-col gap-2.5 pb-2">
            <li
              v-for="m in messages"
              :key="m.id"
              v-memo="[m.id, m.message_type, m.body, m.file_url, m.file_name, m.file_size_bytes, m.created_at, m.sender_id, readStates]"
              class="flex w-full gap-2"
              :class="m.sender_id === myUid ? 'justify-end' : 'justify-start'"
            >
              <UserAvatar
                v-if="m.sender_id !== myUid"
                :custom-avatar-url="senderPublicAvatarUrl(m.sender_id)"
                :seed-user-id="String(m.sender_id || '')"
                size-class="h-8 w-8 shrink-0 self-end"
                ring-class="ring-2 ring-slate-200/80"
              />
              <div
                class="flex max-w-[85%] flex-col sm:max-w-[78%]"
                :class="m.sender_id === myUid ? 'items-end' : 'items-start'"
              >
                <!-- 文件：微信式白底卡片（收发样式一致） -->
                <div
                  v-if="m.message_type === 'file'"
                  class="w-full max-w-[18.5rem] overflow-hidden rounded-lg bg-white text-[15px] leading-relaxed text-slate-900 shadow-sm ring-1 ring-slate-200/[0.88]"
                >
                  <p class="border-b border-slate-100 px-3 py-1.5 text-[10px] font-medium text-slate-400">
                    {{ m.sender_id === myUid ? '我' : otherName }} · {{ formatMsgTime(m.created_at) }}
                  </p>
                  <button
                    type="button"
                    class="w-full text-left transition hover:bg-slate-50/90 focus:outline-none focus-visible:bg-slate-50"
                    @click="openChatFileUrl(m.file_url)"
                  >
                    <div class="flex gap-3 px-3 py-2.5">
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-[15px] font-medium leading-snug text-slate-900">
                          {{ m.file_name || '未命名文件' }}
                        </p>
                        <p v-if="formatStoredFileSize(m.file_size_bytes)" class="mt-0.5 text-[12px] text-slate-400">
                          {{ formatStoredFileSize(m.file_size_bytes) }}
                        </p>
                      </div>
                      <div
                        class="relative h-11 w-11 shrink-0 overflow-hidden rounded shadow-sm"
                        :class="
                          fileMessageKind(m) === 'pdf'
                            ? 'bg-[#e64340]'
                            : fileMessageKind(m) === 'image'
                              ? 'bg-slate-200 ring-1 ring-slate-200/80'
                              : 'bg-slate-500'
                        "
                      >
                        <img
                          v-if="fileMessageKind(m) === 'image'"
                          :src="m.file_url"
                          alt=""
                          width="44"
                          height="44"
                          class="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                          referrerpolicy="no-referrer"
                        />
                        <span
                          v-else
                          class="absolute inset-0 flex items-center justify-center text-[10px] font-bold leading-none text-white"
                        >
                          {{ fileMessageKind(m) === 'pdf' ? 'PDF' : 'FILE' }}
                        </span>
                      </div>
                    </div>
                    <div class="border-t border-slate-100 px-3 py-1.5">
                      <p class="text-[11px] text-slate-400">聊天附件 · 点击打开</p>
                    </div>
                  </button>
                </div>
                <div
                  v-else
                  class="rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed shadow-sm"
                  :class="
                    m.sender_id === myUid
                      ? 'rounded-br-md bg-brand-600 text-white'
                      : 'rounded-bl-md bg-slate-100 text-slate-900 ring-1 ring-slate-200/80'
                  "
                >
                  <p class="text-[10px] font-medium opacity-80">
                    {{ m.sender_id === myUid ? '我' : otherName }} · {{ formatMsgTime(m.created_at) }}
                  </p>
                  <p class="mt-1 whitespace-pre-wrap break-words">{{ m.body ?? m.content }}</p>
                </div>
                <p
                  v-if="showReadReceipt(m)"
                  class="mt-0.5 pr-0.5 text-[10px] font-medium text-slate-400"
                >
                  已读
                </p>
              </div>
              <UserAvatar
                v-if="m.sender_id === myUid"
                :user="myUser"
                :seed-user-id="myUid"
                size-class="h-8 w-8 shrink-0 self-end"
                ring-class="ring-2 ring-brand-200/80"
              />
            </li>
          </ul>
          <div ref="bottomEl" class="h-px w-full shrink-0" aria-hidden="true" />
        </div>

        <div
          class="mt-3 shrink-0 rounded-[var(--app-radius-xl)] border border-slate-200/90 bg-white p-3 shadow-card ring-1 ring-slate-900/[0.02] sm:p-4"
        >
          <div class="flex flex-wrap items-end gap-2">
            <textarea
              v-model="input"
              rows="2"
              class="min-h-[2.75rem] flex-1 resize-none rounded-[var(--app-radius)] border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-900 outline-none ring-brand-500/20 transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-2"
              placeholder="输入消息，Enter 发送（Shift+Enter 换行）"
              @keydown.enter.exact.prevent="void sendText()"
            />
            <input
              ref="fileInputRef"
              type="file"
              class="hidden"
              accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/gif"
              @change="void onFileChange($event)"
            />
            <button
              type="button"
              class="app-btn-secondary shrink-0 px-3 py-2 text-sm"
              :disabled="uploading"
              @click="pickFile"
            >
              {{ uploading ? '上传中…' : '简历/文件' }}
            </button>
            <button
              type="button"
              class="app-btn-primary shrink-0 px-4 py-2 text-sm"
              :disabled="sending"
              @click="void sendText()"
            >
              {{ sending ? '发送中…' : '发送' }}
            </button>
          </div>
          <p class="mt-2 text-[11px] text-slate-500">支持 PDF 与常见图片格式，单文件不超过 10MB。</p>
          <p v-if="lastFileError" class="mt-1 text-[11px] text-red-600">{{ lastFileError }}</p>
        </div>
      </template>
    </div>
  </div>
</template>
