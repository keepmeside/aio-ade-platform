import { useCallback, useEffect, useMemo } from 'react'
import type { FeatureWallWorkflowId } from '../../../../shared/feature-wall-workflows'
import type { WorkbenchStepId } from '../../../../shared/workbench-steps'
import type { ReviewStepId } from '../../../../shared/review-steps'
import type { FeatureWallTourDepthSummary } from '../../../../shared/feature-wall-tour-depth'
import {
  getCommitMessageAgentCapability,
  isCustomAgentId,
  resolveCommitMessageAgentChoice
} from '../../../../shared/commit-message-agent-spec'
import { useAppStore } from '@/store'
import {
  FEATURE_WALL_REVIEW_STEP_IDS,
  FEATURE_WALL_WORKBENCH_STEP_IDS,
  getFeatureWallCompletionProgress
} from './feature-wall-completion-progress'
import { usePersistedFeatureWallCompletion } from './use-persisted-feature-wall-completion'
import { useFeatureWallSessionDepth } from './use-feature-wall-session-depth'

export type FeatureWallCompletionState = {
  workflowDone: Record<FeatureWallWorkflowId, boolean>
  workbenchStepDone: Record<WorkbenchStepId, boolean>
  reviewStepDone: Record<ReviewStepId, boolean>
  markWorkflowVisited: (id: FeatureWallWorkflowId) => void
  markWorkbenchStepVisited: (id: WorkbenchStepId) => void
  markReviewStepVisited: (id: ReviewStepId) => void
  getTourDepthSummary: () => FeatureWallTourDepthSummary
}

export function useFeatureWallCompletion(
  isOpen: boolean,
  hasConnectedTaskSource: boolean,
  isCheckingTaskSources: boolean,
  browserUseSkillInstalled: boolean,
  options: { onTourDepthSummaryChange?: (summary: FeatureWallTourDepthSummary) => void } = {}
): FeatureWallCompletionState {
  const settings = useAppStore((s) => s.settings)
  const preflightStatus = useAppStore((s) => s.preflightStatus)
  const githubConfigured =
    preflightStatus?.gh.installed === true && preflightStatus.gh.authenticated === true
  const commitMessageAi = settings?.commitMessageAi
  const resolvedCommitMessageAgent =
    settings && commitMessageAi?.enabled === true
      ? resolveCommitMessageAgentChoice(
          commitMessageAi.agentId,
          settings.defaultTuiAgent,
          settings.disabledTuiAgents
        )
      : null
  const aiCommitPrConfigured =
    commitMessageAi?.enabled === true &&
    (isCustomAgentId(resolvedCommitMessageAgent)
      ? (commitMessageAi.customAgentCommand ?? '').trim().length > 0
      : resolvedCommitMessageAgent
        ? getCommitMessageAgentCapability(resolvedCommitMessageAgent) !== undefined
        : false)

  const persistedCompletion = usePersistedFeatureWallCompletion()
  const {
    visitedWorkflows,
    visitedWorkbenchSteps,
    visitedReviewSteps,
    completedWorkflows,
    completedWorkbenchSteps,
    completedReviewSteps,
    markWorkflowVisited,
    markWorkbenchStepVisited,
    markReviewStepVisited,
    markWorkflowCompleted,
    markWorkbenchStepCompleted,
    markReviewStepCompleted
  } = persistedCompletion

  const sessionDepth = useFeatureWallSessionDepth({
    isOpen,
    hasConnectedTaskSource,
    isCheckingTaskSources,
    browserUseSkillInstalled,
    githubConfigured,
    aiCommitPrConfigured,
    onTourDepthSummaryChange: options.onTourDepthSummaryChange
  })

  const currentProgress = useMemo(
    () =>
      getFeatureWallCompletionProgress({
        visitedWorkflows,
        visitedWorkbenchSteps,
        visitedReviewSteps,
        hasConnectedTaskSource,
        isCheckingTaskSources,
        browserUseSkillInstalled,
        githubConfigured,
        aiCommitPrConfigured
      }),
    [
      aiCommitPrConfigured,
      browserUseSkillInstalled,
      githubConfigured,
      hasConnectedTaskSource,
      isCheckingTaskSources,
      visitedReviewSteps,
      visitedWorkbenchSteps,
      visitedWorkflows
    ]
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }
    for (const id of Object.keys(currentProgress.workflowDone) as FeatureWallWorkflowId[]) {
      if (currentProgress.workflowDone[id] && !completedWorkflows.has(id)) {
        markWorkflowCompleted(id)
      }
    }
    for (const id of FEATURE_WALL_WORKBENCH_STEP_IDS) {
      if (currentProgress.workbenchStepDone[id] && !completedWorkbenchSteps.has(id)) {
        markWorkbenchStepCompleted(id)
      }
    }
    for (const id of FEATURE_WALL_REVIEW_STEP_IDS) {
      if (currentProgress.reviewStepDone[id] && !completedReviewSteps.has(id)) {
        markReviewStepCompleted(id)
      }
    }
  }, [
    completedReviewSteps,
    completedWorkbenchSteps,
    completedWorkflows,
    currentProgress,
    isOpen,
    markReviewStepCompleted,
    markWorkbenchStepCompleted,
    markWorkflowCompleted
  ])

  const { workflowDone, workbenchStepDone, reviewStepDone } = useMemo(
    () =>
      getFeatureWallCompletionProgress({
        visitedWorkflows,
        visitedWorkbenchSteps,
        visitedReviewSteps,
        completedWorkflows,
        completedWorkbenchSteps,
        completedReviewSteps,
        hasConnectedTaskSource,
        isCheckingTaskSources,
        browserUseSkillInstalled,
        githubConfigured,
        aiCommitPrConfigured
      }),
    [
      aiCommitPrConfigured,
      browserUseSkillInstalled,
      completedReviewSteps,
      completedWorkbenchSteps,
      completedWorkflows,
      githubConfigured,
      hasConnectedTaskSource,
      isCheckingTaskSources,
      visitedReviewSteps,
      visitedWorkbenchSteps,
      visitedWorkflows
    ]
  )

  const markWorkflowVisitedForSession = useCallback(
    (id: FeatureWallWorkflowId): void => {
      markWorkflowVisited(id)
      sessionDepth.markWorkflowVisitedForSession(id)
    },
    [markWorkflowVisited, sessionDepth]
  )
  const markWorkbenchStepVisitedForSession = useCallback(
    (id: WorkbenchStepId): void => {
      markWorkbenchStepVisited(id)
      sessionDepth.markWorkbenchStepVisitedForSession(id)
    },
    [markWorkbenchStepVisited, sessionDepth]
  )
  const markReviewStepVisitedForSession = useCallback(
    (id: ReviewStepId): void => {
      markReviewStepVisited(id)
      sessionDepth.markReviewStepVisitedForSession(id)
    },
    [markReviewStepVisited, sessionDepth]
  )

  return {
    workflowDone,
    workbenchStepDone,
    reviewStepDone,
    markWorkflowVisited: markWorkflowVisitedForSession,
    markWorkbenchStepVisited: markWorkbenchStepVisitedForSession,
    markReviewStepVisited: markReviewStepVisitedForSession,
    getTourDepthSummary: sessionDepth.getTourDepthSummary
  }
}
