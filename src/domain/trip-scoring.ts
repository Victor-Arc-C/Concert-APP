import type {
  TripOption,
  TripRecommendationLabel,
  TransportOption,
  AccommodationOption,
} from './trip-types';


/**
 * Calculates music fit (0 to 100).
 * Matches the existing recommendation ranking philosophy:
 * Favorites & must-sees score higher; followed artists score well; discovery scores lower.
 */
export function calculateMusicFit(
  artistIds: string[],
  userAffinities: { artistId: string; favorite: boolean; hidden: boolean }[],
  userIntents: { artistId: string; cities: string[] }[],
  concertScore?: number,
): number {
  if (concertScore !== undefined && concertScore >= 0 && concertScore <= 100) {
    return Math.round(concertScore);
  }
  const matched = userAffinities.filter((a) => artistIds.includes(a.artistId) && !a.hidden);
  if (matched.length === 0) return 30; // Unfollowed / discovery artist

  const favorite = matched.some((a) => a.favorite);
  const mustSee = userIntents.some((i) => matched.some((a) => a.artistId === i.artistId));

  if (mustSee) return 98;
  if (favorite) return 92;
  return 75;
}

/**
 * Calculates total cost and verifies currency homogeneity.
 * Never invents missing components or performs unsupported cross-currency addition.
 */
export function calculateTotalCost(
  ticketPrice: number | null,
  ticketCurrency: string | null,
  transportPrice: number | null,
  transportCurrency: string | null,
  accommodationPrice: number | null,
  accommodationCurrency: string | null,
): { total: number | null; currency: string | null } {
  // If any component is null, total cannot be calculated with certainty.
  if (ticketPrice === null || transportPrice === null || accommodationPrice === null) {
    return { total: null, currency: null };
  }

  // Verify non-negative finite numbers
  if (
    !Number.isFinite(ticketPrice) ||
    ticketPrice < 0 ||
    !Number.isFinite(transportPrice) ||
    transportPrice < 0 ||
    !Number.isFinite(accommodationPrice) ||
    accommodationPrice < 0
  ) {
    return { total: null, currency: null };
  }

  // Verify all currencies are present, 3 uppercase letters, and match
  if (!ticketCurrency || !transportCurrency || !accommodationCurrency) {
    return { total: null, currency: null };
  }
  if (
    ticketCurrency !== transportCurrency ||
    transportCurrency !== accommodationCurrency
  ) {
    // Cross-currency sum is unsupported without verified fx
    return { total: null, currency: null };
  }

  return {
    total: Math.round((ticketPrice + transportPrice + accommodationPrice) * 100) / 100,
    currency: ticketCurrency,
  };
}

/**
 * Calculates cost score (0 to 100), where lower cost yields higher score.
 * If total cost is unknown, falls back to a neutral 50.
 */
export function calculateCostScore(
  totalCost: number | null,
  userBudget: number | null = null,
): number {
  if (totalCost === null || !Number.isFinite(totalCost) || totalCost < 0) {
    return 50; // Neutral score when cost is unknown
  }

  // Reference scale: <= €100 is 100, >= €600 is 10.
  // If user budget is provided, scale relative to user budget.
  if (userBudget && userBudget > 0) {
    if (totalCost <= userBudget * 0.6) return 95;
    if (totalCost <= userBudget) return 80;
    if (totalCost <= userBudget * 1.5) return 40;
    return 15;
  }

  const normalized = Math.max(0, Math.min(1, (600 - totalCost) / 500));
  return Math.round(15 + normalized * 80);
}

/**
 * Calculates convenience score (0 to 100).
 * Factoring:
 * - Transport duration (e.g. 1h30 = fast, 6h = slow)
 * - Number of changes (direct = 0 changes)
 * - Accommodation distance to venue (<= 2km is ideal)
 */
export function calculateConvenienceScore(
  transport: TransportOption,
  accommodation: AccommodationOption,
): number {
  let score = 100;

  // Duration penalty: 60 mins -> no penalty, each hour beyond drops score
  const durationHours = transport.durationMinutes / 60;
  if (durationHours > 2) {
    score -= Math.min(40, (durationHours - 2) * 8);
  }

  // Changes penalty
  score -= transport.changes * 12;

  // Accommodation distance penalty
  if (accommodation.distanceKmToVenue !== null) {
    if (accommodation.distanceKmToVenue > 2) {
      score -= Math.min(25, (accommodation.distanceKmToVenue - 2) * 4);
    }
  } else {
    // Slightly uncertain
    score -= 5;
  }

  return Math.max(10, Math.min(100, Math.round(score)));
}

/**
 * Calculates overall trip score (0 to 100).
 * Weighted formula:
 * - Music fit: 40%
 * - Convenience: 35%
 * - Cost score: 25%
 */
export function calculateOverallScore(
  musicFit: number,
  convenienceScore: number,
  costScore: number,
): number {
  const overall = musicFit * 0.4 + convenienceScore * 0.35 + costScore * 0.25;
  return Math.max(0, Math.min(100, Math.round(overall)));
}

/**
 * Assigns recommendation labels to a set of generated trip options for the same event:
 * - 'Cheapest': Lowest known total cost (only when at least 2 options have valid costs and one is strictly cheaper)
 * - 'Fastest': Shortest duration transport (only when at least 2 options differ in duration)
 * - 'Easiest': Highest convenience score (direct, close stay, etc.)
 * - 'Best value': Highest overall trip score
 *
 * Rules: Labels must ONLY be produced when comparisons are supported by sufficient data.
 */
export function assignTripLabels(options: TripOption[]): TripOption[] {
  if (options.length === 0) return [];
  if (options.length === 1) {
    // With only 1 option, comparison labels (Cheapest, Fastest, Easiest) are not supported.
    // 'Best value' can be assigned only if the overall score is high (>= 75).
    const single = options[0];
    return [
      {
        ...single,
        label: single.scores.overallScore >= 75 ? 'Best value' : null,
      },
    ];
  }

  // 1. Identify Cheapest (requires at least 2 comparable totals in the same currency)
  const validCostOptions = options.filter(
    (o) => o.estimatedTotal !== null && o.totalCurrency !== null,
  );
  let cheapestId: string | null = null;
  if (validCostOptions.length >= 2) {
    const firstCurrency = validCostOptions[0].totalCurrency;
    const sameCurrency = validCostOptions.filter((o) => o.totalCurrency === firstCurrency);
    if (sameCurrency.length >= 2) {
      sameCurrency.sort((a, b) => (a.estimatedTotal ?? 0) - (b.estimatedTotal ?? 0));
      if (sameCurrency[0].estimatedTotal! < sameCurrency[1].estimatedTotal!) {
        cheapestId = sameCurrency[0].id;
      }
    }
  }

  // 2. Identify Fastest (requires at least 2 options differing in duration)
  const sortedByDuration = [...options].sort(
    (a, b) => a.transport.durationMinutes - b.transport.durationMinutes,
  );
  let fastestId: string | null = null;
  if (
    sortedByDuration.length >= 2 &&
    sortedByDuration[0].transport.durationMinutes <
      sortedByDuration[1].transport.durationMinutes
  ) {
    fastestId = sortedByDuration[0].id;
  }

  // 3. Identify Easiest (highest convenience score, differing by at least 5 points)
  const sortedByConvenience = [...options].sort(
    (a, b) => b.scores.convenienceScore - a.scores.convenienceScore,
  );
  let easiestId: string | null = null;
  if (
    sortedByConvenience.length >= 2 &&
    sortedByConvenience[0].scores.convenienceScore >=
      sortedByConvenience[1].scores.convenienceScore + 5
  ) {
    easiestId = sortedByConvenience[0].id;
  }

  // 4. Identify Best value (highest overall score)
  const sortedByOverall = [...options].sort(
    (a, b) => b.scores.overallScore - a.scores.overallScore,
  );
  let bestValueId: string | null = null;
  if (sortedByOverall[0].scores.overallScore >= 70) {
    bestValueId = sortedByOverall[0].id;
  }

  // Assign labels deterministically without colliding where possible.
  // Priority: Best value > Cheapest > Fastest > Easiest
  const assigned = new Set<string>();

  return options.map((option) => {
    let label: TripRecommendationLabel | null = null;

    if (option.id === bestValueId && !assigned.has('Best value')) {
      label = 'Best value';
      assigned.add('Best value');
    } else if (option.id === cheapestId && !assigned.has('Cheapest')) {
      label = 'Cheapest';
      assigned.add('Cheapest');
    } else if (option.id === fastestId && !assigned.has('Fastest')) {
      label = 'Fastest';
      assigned.add('Fastest');
    } else if (option.id === easiestId && !assigned.has('Easiest')) {
      label = 'Easiest';
      assigned.add('Easiest');
    }

    return { ...option, label };
  });
}
