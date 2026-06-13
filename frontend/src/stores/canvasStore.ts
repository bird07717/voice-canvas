import { create } from 'zustand'
import Konva from 'konva'

interface CanvasState {
  currentCanvasId: number | null
  canvasObjects: any[]
  history: any[][]
  historyStep: number
  isDrawing: boolean
  stageRef: Konva.Stage | null

  setCurrentCanvasId: (id: number | null) => void
  setCanvasObjects: (objects: any[]) => void
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
  history: [[]],
  historyStep: 0,
  isDrawing: false,
  stageRef: null,

  setCurrentCanvasId: (id) => set({ currentCanvasId: id }),

  setCanvasObjects: (objects) => set({ canvasObjects: objects }),

  addObject: (object) => {
    set((state) => ({
      canvasObjects: [...state.canvasObjects, object],
    }))
    get().saveToHistory()
  },

  updateObject: (id, updates) => {
    set((state) => ({
      canvasObjects: state.canvasObjects.map((obj) =>
        obj.id === id ? { ...obj, ...updates } : obj
      ),
    }))
    get().saveToHistory()
  },

  removeObject: (id) => {
    set((state) => ({
      canvasObjects: state.canvasObjects.filter((obj) => obj.id !== id),
    }))
    get().saveToHistory()
  },

  clearCanvas: () => {
    set({ canvasObjects: [] })
    get().saveToHistory()
  },

  undo: () => {
    const { history, historyStep } = get()
    if (historyStep > 0) {
      const newStep = historyStep - 1
      set({
        historyStep: newStep,
        canvasObjects: JSON.parse(JSON.stringify(history[newStep])),
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
      })
    }
  },
}))
