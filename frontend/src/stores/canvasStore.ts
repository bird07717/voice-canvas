import { create } from 'zustand'
import Konva from 'konva'

interface CanvasState {
  currentCanvasId: number | null
  canvasObjects: any[]
  lastCreatedObjectId: string | null
  lastModifiedObjectId: string | null
  selectedObjectId: string | null
  recentCommands: any[]
  history: any[][]
  historyStep: number
  isDrawing: boolean
  stageRef: Konva.Stage | null

  setCurrentCanvasId: (id: number | null) => void
  setCanvasObjects: (objects: any[]) => void
  setSelectedObjectId: (id: string | null) => void
  recordCommands: (commands: any[]) => void
  addObject: (object: any) => void
  updateObject: (id: string, updates: any) => void
  removeObject: (id: string) => void
  clearCanvas: () => void
  undo: () => void
  redo: () => void
  saveToHistory: () => void
  setStageRef: (stage: Konva.Stage | null) => void
  loadCanvasJson: (json: any) => void
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  currentCanvasId: null,
  canvasObjects: [],
  lastCreatedObjectId: null,
  lastModifiedObjectId: null,
  selectedObjectId: null,
  recentCommands: [],
  history: [[]],
  historyStep: 0,
  isDrawing: false,
  stageRef: null,

  setCurrentCanvasId: (id) => set({ currentCanvasId: id }),

  setCanvasObjects: (objects) => set({ canvasObjects: objects }),

  setSelectedObjectId: (id) => set({ selectedObjectId: id }),

  recordCommands: (commands) =>
    set((state) => ({
      recentCommands: [...state.recentCommands, ...commands].slice(-20),
    })),

  addObject: (object) => {
    set((state) => ({
      canvasObjects: [...state.canvasObjects, object],
      lastCreatedObjectId: object.id,
      lastModifiedObjectId: object.id,
    }))
    get().saveToHistory()
  },

  updateObject: (id, updates) => {
    set((state) => ({
      canvasObjects: state.canvasObjects.map((obj) =>
        obj.id === id
          ? { ...obj, params: { ...obj.params, ...updates } }
          : obj
      ),
      lastModifiedObjectId: id,
    }))
    get().saveToHistory()
  },

  removeObject: (id) => {
    set((state) => ({
      canvasObjects: state.canvasObjects.filter((obj) => obj.id !== id),
      selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
    }))
    get().saveToHistory()
  },

  clearCanvas: () => {
    set({
      canvasObjects: [],
      lastCreatedObjectId: null,
      lastModifiedObjectId: null,
      selectedObjectId: null,
      recentCommands: [],
    })
    get().saveToHistory()
  },

  undo: () => {
    const { history, historyStep } = get()
    if (historyStep > 0) {
      const newStep = historyStep - 1
      set({
        historyStep: newStep,
        canvasObjects: JSON.parse(JSON.stringify(history[newStep])),
        lastModifiedObjectId: null,
      })
    }
  },

  redo: () => {
    const { history, historyStep } = get()
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1
      set({
        historyStep: newStep,
        canvasObjects: JSON.parse(JSON.stringify(history[newStep])),
        lastModifiedObjectId: null,
      })
    }
  },

  saveToHistory: () => {
    const { canvasObjects, history, historyStep } = get()
    const newHistory = history.slice(0, historyStep + 1)
    newHistory.push(JSON.parse(JSON.stringify(canvasObjects)))
    set({
      history: newHistory,
      historyStep: newHistory.length - 1,
    })
  },

  setStageRef: (stage) => set({ stageRef: stage }),

  loadCanvasJson: (json) => {
    if (json && json.objects) {
      set({
        canvasObjects: json.objects,
        history: [json.objects],
        historyStep: 0,
        lastCreatedObjectId: json.objects[json.objects.length - 1]?.id || null,
        lastModifiedObjectId: null,
        selectedObjectId: null,
        recentCommands: [],
      })
    }
  },
}))
