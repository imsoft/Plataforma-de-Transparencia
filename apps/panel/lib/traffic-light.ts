import type { Coverage } from '@platform/db/queries/documents'
import {
  DEFAULT_TRAFFIC_LIGHT_CONFIG,
  nodeStatus,
  type Frequency,
  type TrafficLightResult,
} from '@platform/law-index'
import { todayMexico } from './dates'

export function trafficLightOf(
  node: { frequency: Frequency },
  coverage: Coverage | undefined,
  today = todayMexico(),
): TrafficLightResult {
  return nodeStatus(
    {
      frequency: node.frequency,
      coveredPeriods: coverage?.periods ?? [],
      hasDocuments: (coverage?.total ?? 0) > 0,
    },
    today,
    DEFAULT_TRAFFIC_LIGHT_CONFIG,
  )
}
