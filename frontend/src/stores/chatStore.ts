import { create } from 'zustand'
import { fetchDefaultModel, saveSelectedModel } from '@/services/api/models'
import { reportError } from '@/lib/appError'
import { makeSession } from '@/stores/sessionPatch'
import { makeProject, type ChatState } from '@/stores/chatModel'
import { sessionActions } from '@/stores/sessionActions'
import { projectActions } from '@/stores/projectActions'
import { messageActions } from '@/stores/messageActions'
import { clearPreviewPatch } from '@/stores/streamEvents'
import { saveLastView } from '@/stores/lastView'

export type { AgentStatus, Project, SessionSnapshot } from '@/stores/chatModel'

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const defaultProject = makeProject('General')
const initialSession = makeSession(defaultProject.id)

export const useChatStore = create<ChatState>((set, get) => ({
  projects: [defaultProject],
  activeProjectId: defaultProject.id,

  sessions: [initialSession],
  activeId: initialSession.id,

  messages: [],
  sessionId: null,
  isStreaming: false,
  sessionsLoading: true,
  chatLoading: false,
  tokenUsage: { inputTokens: 0, outputTokens: 0 },
  error: null,
  // The backend keeps the choice (see initProvider), so every window starts with the same model
  provider: '',
  model: '',

  executionPreview: null,
  clearExecutionPreview: (previewId) => set((s) => clearPreviewPatch(s, previewId)),
  autoEdits: false,
  setAutoEdits: (on) => set({ autoEdits: on }),

  agentStatus: 'idle',
  lastEventAt: 0,
  abortController: null,

  ...sessionActions(set, get),
  ...projectActions(set, get),
  ...messageActions(set, get),
  setModel: (provider, model) => {
    set({ provider, model })
    saveSelectedModel(provider, model).catch((e) => reportError('Could not save the model choice', e))
  },

  reset: () => get().newSession(),

  initProvider: async () => {
    const result = await fetchDefaultModel()
    if (result) set({ provider: result.provider, model: result.model })
  },
}))

useChatStore.subscribe(saveLastView)
