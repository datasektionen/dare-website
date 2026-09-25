import { queryOptions } from "@tanstack/react-query"
import { getFeatures } from "./functions"

export const featuresQuery = queryOptions({
  queryKey: ["features"],
  queryFn: () => getFeatures(),
})
