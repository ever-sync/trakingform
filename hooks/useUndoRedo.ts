import { useReducer, useCallback } from 'react'

type UndoRedoState<T> = {
  past: T[]
  present: T
  future: T[]
}

type UndoRedoAction<T> =
  | { type: 'SET'; payload: T }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET'; payload: T }

const MAX_HISTORY = 30

function reducer<T>(state: UndoRedoState<T>, action: UndoRedoAction<T>): UndoRedoState<T> {
  switch (action.type) {
    case 'SET': {
      const past = [...state.past, state.present].slice(-MAX_HISTORY)
      return { past, present: action.payload, future: [] }
    }
    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      const past = state.past.slice(0, -1)
      return { past, present: previous, future: [state.present, ...state.future] }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      const future = state.future.slice(1)
      return { past: [...state.past, state.present], present: next, future }
    }
    case 'RESET':
      return { past: [], present: action.payload, future: [] }
    default:
      return state
  }
}

export function useUndoRedo<T>(initialValue: T) {
  const [state, dispatch] = useReducer(reducer<T>, {
    past: [],
    present: initialValue,
    future: [],
  })

  const set = useCallback((value: T) => dispatch({ type: 'SET', payload: value }), [])
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])
  const reset = useCallback((value: T) => dispatch({ type: 'RESET', payload: value }), [])

  return {
    value: state.present,
    set,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
