import { currentQuote } from './trip-safety';
import { displayPrice } from './pricing';
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
  if (
    !ticketCurrency ||
    !transportCurrency ||
    !accommodationCurrency ||
    !/^[A-Z]{3}$/.test(ticketCurrency) ||
    !/^[A-Z]{3}$/.test(transportCurrency) ||
    !/^[A-Z]{3}$/.test(accommodationCurrency)
  ) {
    return { total: null, currency: null };
  }
  if (ticketCurrency !== transportCurrency || transportCurrency !== accommodationCurrency) {
    // Cross-currency sum is unsupported without verified fx
    return { total: null, currency: null };
  }

  const total = Math.round((ticketPrice + transportPrice + accommodationPrice) * 100) / 100;
  return Number.isFinite(total)
    ? { total, currency: ticketCurrency }
    : { total: null, currency: null };
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
export function assignTripLabels(options: TripOption[], now = new Date()): TripOption[] {
  const cleared = options.map((option) => ({ ...option, label: null }));
  if (options.length < 2 || new Set(options.map((option) => option.id)).size !== options.length)
    return cleared;
  const first = options[0];
  // A badge compares the entire displayed candidate set, never a convenient subset.
  // Missing/incomplete prices, stale availability and mixed sample/live or FX suppress all labels.
  if (
    !options.every((option) => {
      const travel = option.transport,
        stay = option.accommodation;
      const total = calculateTotalCost(
        option.ticketPrice,
        option.ticketCurrency,
        travel?.price ?? null,
        travel?.currency ?? null,
        stay?.price ?? null,
        stay?.currency ?? null,
      );
      return (
        option.planStatus === 'active' &&
        travel &&
        stay &&
        option.transportState === 'ready' &&
        option.accommodationState === 'ready' &&
        currentQuote(travel, now) &&
        currentQuote(stay, now) &&
        travel.kind === option.mode &&
        stay.kind === option.mode &&
        option.mode === first.mode &&
        travel.priceComplete &&
        stay.priceComplete &&
        stay.distanceKmToVenue !== null &&
        Number.isFinite(stay.distanceKmToVenue) &&
        stay.distanceKmToVenue >= 0 &&
        Number.isFinite(travel.durationMinutes) &&
        travel.durationMinutes > 0 &&
        Number.isInteger(travel.changes) &&
        travel.changes >= 0 &&
        option.ticketObservedAt !== null &&
        option.ticketPrice !== null &&
        displayPrice(
          option.ticketPrice,
          option.ticketCurrency,
          option.ticketProvider ?? '',
          option.ticketObservedAt,
          now,
        ) !== null &&
        total.total !== null &&
        total.total === option.estimatedTotal &&
        total.currency === option.totalCurrency &&
        option.totalCurrency === first.totalCurrency &&
        option.eventId === first.eventId &&
        option.eventDate === first.eventDate &&
        option.originCity === first.originCity &&
        option.destinationCity === first.destinationCity &&
        stay.guests === first.accommodation?.guests &&
        stay.checkIn.slice(0, 10) === first.accommodation?.checkIn.slice(0, 10) &&
        stay.checkOut.slice(0, 10) === first.accommodation?.checkOut.slice(0, 10) &&
        option.scores.convenienceScore !== null &&
        Number.isFinite(option.scores.convenienceScore) &&
        option.scores.overallScore !== null &&
        Number.isFinite(option.scores.overallScore)
      );
    })
  )
    return cleared;

  const cost = [...options].sort(
    (a, b) => a.estimatedTotal! - b.estimatedTotal! || a.id.localeCompare(b.id),
  );
  const duration = [...options].sort(
    (a, b) =>
      a.transport!.durationMinutes - b.transport!.durationMinutes || a.id.localeCompare(b.id),
  );
  const convenience = [...options].sort(
    (a, b) => b.scores.convenienceScore! - a.scores.convenienceScore! || a.id.localeCompare(b.id),
  );
  const overall = [...options].sort(
    (a, b) => b.scores.overallScore! - a.scores.overallScore! || a.id.localeCompare(b.id),
  );
  const cheapestId = cost[0].estimatedTotal! < cost[1].estimatedTotal! ? cost[0].id : null;
  const fastestId =
    duration[0].transport!.durationMinutes < duration[1].transport!.durationMinutes
      ? duration[0].id
      : null;
  const easiestId =
    convenience[0].scores.convenienceScore! >= convenience[1].scores.convenienceScore! + 5
      ? convenience[0].id
      : null;
  const bestValueId =
    overall[0].scores.overallScore! >= 70 &&
    overall[0].scores.overallScore! > overall[1].scores.overallScore!
      ? overall[0].id
      : null;
  return options.map((option) => {
    let label: TripRecommendationLabel | null = null;
    if (option.id === bestValueId) label = 'Best value';
    else if (option.id === cheapestId) label = 'Cheapest';
    else if (option.id === fastestId) label = 'Fastest';
    else if (option.id === easiestId) label = 'Easiest';
    return { ...option, label };
  });
}

export type CostPart = {
  kind: 'ticket' | 'transport' | 'stay';
  /** Current price, or null when the seller lists none or it is no longer current. */
  price: number | null;
  /** True when the price leaves something out (hotel taxes paid on site, partial fare). */
  partial: boolean;
};
export type KnownCost = {
  /** Sum of the current prices we have, or null when there are none or currencies differ. */
  sum: number | null;
  currency: string | null;
  /** Every part priced, complete and current: the sum is the whole trip. */
  complete: boolean;
  parts: CostPart[];
};

/**
 * What the trip costs as far as current prices go. Missing parts are listed as missing, never
 * guessed, so "Known so far" can show a real figure before every price exists.
 */
export function knownTripCost(option: {
  ticketPrice: number | null;
  ticketCurrency: string | null;
  ticketPriceState: string;
  transport: { price: number | null; currency: string | null; priceComplete: boolean } | null;
  transportState: string;
  accommodation: { price: number | null; currency: string | null; priceComplete: boolean } | null;
  accommodationState: string;
}): KnownCost {
  const usable = (price: number | null | undefined, state: string) =>
    state === 'ready' && typeof price === 'number' && Number.isFinite(price) && price >= 0
      ? price
      : null;
  const parts: (CostPart & { currency: string | null })[] = [
    {
      kind: 'ticket',
      price: usable(option.ticketPrice, option.ticketPriceState),
      currency: option.ticketCurrency,
      partial: false,
    },
    {
      kind: 'transport',
      price: usable(option.transport?.price, option.transportState),
      currency: option.transport?.currency ?? null,
      partial: option.transport ? !option.transport.priceComplete : false,
    },
    {
      kind: 'stay',
      price: usable(option.accommodation?.price, option.accommodationState),
      currency: option.accommodation?.currency ?? null,
      partial: option.accommodation ? !option.accommodation.priceComplete : false,
    },
  ];
  const priced = parts.filter((part) => part.price !== null);
  const currencies = new Set(priced.map((part) => part.currency));
  const currency = currencies.size === 1 ? [...currencies][0] : null;
  const sum =
    priced.length && currency && /^[A-Z]{3}$/.test(currency)
      ? Math.round(priced.reduce((total, part) => total + part.price!, 0) * 100) / 100
      : null;
  return {
    sum,
    currency: sum === null ? null : currency,
    complete: sum !== null && priced.length === parts.length && priced.every((p) => !p.partial),
    parts: parts.map(({ kind, price, partial }) => ({ kind, price, partial })),
  };
}
