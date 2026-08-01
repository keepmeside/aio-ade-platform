import {
  FEATURE_WALL_WORKFLOW_IDS,
  type FeatureWallWorkflowId
} from '../../../../shared/feature-wall-workflows'
import type { ReviewStepId } from '../../../../shared/review-steps'
import type { WorkbenchStepId } from '../../../../shared/workbench-steps'

const PERSISTED_WORKFLOW_IDS = new Set<FeatureWallWorkflowId>(FEATURE_WALL_WORKFLOW_IDS)
const VISITED_WORKFLOWS_STORAGE_KEY = 'orca.featureWall.visitedWorkflows.v1'
const COMPLETED_WORKFLOWS_STORAGE_KEY = 'orca.featureWall.completedWorkflows.v1'
const PERSISTED_WORKBENCH_STEP_IDS = new Set<WorkbenchStepId>(['terminal', 'editor', 'browser'])
const VISITED_WORKBENCH_STEPS_STORAGE_KEY = 'orca.featureWall.visitedWorkbenchSteps.v1'
const COMPLETED_WORKBENCH_STEPS_STORAGE_KEY = 'orca.featureWall.completedWorkbenchSteps.v1'
const PERSISTED_REVIEW_STEP_IDS = new Set<ReviewStepId>(['notes', 'pr-view', 'ship'])
const VISITED_REVIEW_STEPS_STORAGE_KEY = 'orca.featureWall.visitedReviewSteps.v1'
const COMPLETED_REVIEW_STEPS_STORAGE_KEY = 'orca.featureWall.completedReviewSteps.v1'

function readSet<T extends string>(key: string, allowed: ReadonlySet<T>): Set<T> {
  if (typeof localStorage === 'undefined') {
    return new Set()
  }
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    if (!Array.isArray(value)) {
      return new Set()
    }
    return new Set(
      value.filter((item): item is T => typeof item === 'string' && allowed.has(item as T))
    )
  } catch {
    return new Set()
  }
}

function persistSetValue<T extends string>(key: string, allowed: ReadonlySet<T>, id: T): void {
  if (!allowed.has(id) || typeof localStorage === 'undefined') {
    return
  }
  try {
    const next = readSet(key, allowed)
    next.add(id)
    localStorage.setItem(key, JSON.stringify([...next]))
  } catch {
    // localStorage can be unavailable in hardened browser contexts.
  }
}

export const normalizeFeatureWallVisitedWorkflows = (value: unknown): FeatureWallWorkflowId[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (item): item is FeatureWallWorkflowId =>
              typeof item === 'string' && PERSISTED_WORKFLOW_IDS.has(item as FeatureWallWorkflowId)
          )
        )
      ]
    : []

export const normalizeFeatureWallVisitedWorkbenchSteps = (value: unknown): WorkbenchStepId[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (item): item is WorkbenchStepId =>
              typeof item === 'string' && PERSISTED_WORKBENCH_STEP_IDS.has(item as WorkbenchStepId)
          )
        )
      ]
    : []

export const normalizeFeatureWallVisitedReviewSteps = (value: unknown): ReviewStepId[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (item): item is ReviewStepId =>
              typeof item === 'string' && PERSISTED_REVIEW_STEP_IDS.has(item as ReviewStepId)
          )
        )
      ]
    : []

export const readPersistedVisitedWorkflows = (): Set<FeatureWallWorkflowId> =>
  readSet(VISITED_WORKFLOWS_STORAGE_KEY, PERSISTED_WORKFLOW_IDS)
export const readPersistedCompletedWorkflows = (): Set<FeatureWallWorkflowId> =>
  readSet(COMPLETED_WORKFLOWS_STORAGE_KEY, PERSISTED_WORKFLOW_IDS)
export const readPersistedVisitedWorkbenchSteps = (): Set<WorkbenchStepId> =>
  readSet(VISITED_WORKBENCH_STEPS_STORAGE_KEY, PERSISTED_WORKBENCH_STEP_IDS)
export const readPersistedCompletedWorkbenchSteps = (): Set<WorkbenchStepId> =>
  readSet(COMPLETED_WORKBENCH_STEPS_STORAGE_KEY, PERSISTED_WORKBENCH_STEP_IDS)
export const readPersistedVisitedReviewSteps = (): Set<ReviewStepId> =>
  readSet(VISITED_REVIEW_STEPS_STORAGE_KEY, PERSISTED_REVIEW_STEP_IDS)
export const readPersistedCompletedReviewSteps = (): Set<ReviewStepId> =>
  readSet(COMPLETED_REVIEW_STEPS_STORAGE_KEY, PERSISTED_REVIEW_STEP_IDS)

export const persistVisitedWorkflow = (id: FeatureWallWorkflowId): void =>
  persistSetValue(VISITED_WORKFLOWS_STORAGE_KEY, PERSISTED_WORKFLOW_IDS, id)
export const persistCompletedWorkflow = (id: FeatureWallWorkflowId): void =>
  persistSetValue(COMPLETED_WORKFLOWS_STORAGE_KEY, PERSISTED_WORKFLOW_IDS, id)
export const persistVisitedWorkbenchStep = (id: WorkbenchStepId): void =>
  persistSetValue(VISITED_WORKBENCH_STEPS_STORAGE_KEY, PERSISTED_WORKBENCH_STEP_IDS, id)
export const persistCompletedWorkbenchStep = (id: WorkbenchStepId): void =>
  persistSetValue(COMPLETED_WORKBENCH_STEPS_STORAGE_KEY, PERSISTED_WORKBENCH_STEP_IDS, id)
export const persistVisitedReviewStep = (id: ReviewStepId): void =>
  persistSetValue(VISITED_REVIEW_STEPS_STORAGE_KEY, PERSISTED_REVIEW_STEP_IDS, id)
export const persistCompletedReviewStep = (id: ReviewStepId): void =>
  persistSetValue(COMPLETED_REVIEW_STEPS_STORAGE_KEY, PERSISTED_REVIEW_STEP_IDS, id)
