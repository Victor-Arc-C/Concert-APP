import { cityDistanceKm } from '../../domain/recommendations';
import type {
  AccommodationOption,
  AccommodationProvider,
  TransportOption,
  TransportProvider,
} from '../../domain/trip-types';



/**
 * Deterministic Sample/Mock Transport Provider.
 * Generates realistic European train and flight options connecting major cities.
 */
export class SampleTransportProvider implements TransportProvider {
  name = 'Sample European Transport';

  async getOptions(
    origin: string,
    destinationCity: string,
    eventDate: string,
    eventLocalTime: string | null = '20:00:00',
    now = new Date(),
  ): Promise<TransportOption[]> {
    // If user is already in the event city:
    const isLocal = origin.trim().toLowerCase() === destinationCity.trim().toLowerCase();
    const observedAt = now.toISOString();

    if (isLocal) {
      // Local transit option (e.g. metro / local city transit)
      return [
        {
          id: `trans-local-${origin.toLowerCase()}-${eventDate}`,
          provider: 'local-transit',
          mode: 'train',
          origin,
          destination: destinationCity,
          departureAt: `${eventDate}T18:30:00Z`,
          returnAt: `${eventDate}T23:45:00Z`,
          durationMinutes: 30,
          changes: 0,
          price: 5,
          currency: 'EUR',
          observedAt,
          bookingUrl: null,
          operator: 'City Metro / Transit',
        },
      ];
    }

    const distance = cityDistanceKm(origin, destinationCity, 'FR') ?? 400; // rough km
    const showTime = eventLocalTime || '20:00:00';
    const showHour = parseInt(showTime.slice(0, 2), 10) || 20;

    // Train option
    // Calculation: ~150km/h average for European intercity/high-speed rail
    const trainDuration = Math.max(75, Math.round((distance / 160) * 60));
    const trainDepHour = Math.max(10, showHour - Math.ceil(trainDuration / 60) - 2);
    const trainDepTime = `${String(trainDepHour).padStart(2, '0')}:15:00`;
    const trainReturnHour = 10; // next morning
    const nextDay = new Date(Date.parse(`${eventDate}T00:00:00Z`) + 86400000)
      .toISOString()
      .slice(0, 10);

    const trainPrice = Math.max(35, Math.round(distance * 0.18));

    const options: TransportOption[] = [
      {
        id: `trans-train-${origin.toLowerCase()}-${destinationCity.toLowerCase()}-${eventDate}`,
        provider: 'sample-euro-rail',
        mode: 'train',
        origin,
        destination: destinationCity,
        departureAt: `${eventDate}T${trainDepTime}Z`,
        returnAt: `${nextDay}T${String(trainReturnHour).padStart(2, '0')}:30:00Z`,
        durationMinutes: trainDuration,
        changes: distance > 600 ? 1 : 0,
        price: trainPrice,
        currency: 'EUR',
        observedAt,
        bookingUrl: `https://www.sncf-connect.com`,
        operator: 'Euro High-Speed Rail',
      },
    ];

    // If distance > 450km, add a flight option (faster but higher cost or check-in overhead)
    if (distance > 450) {
      const flightDuration = Math.round(75 + (distance / 700) * 40); // flight in air + basic transfer
      const flightPrice = Math.max(55, Math.round(trainPrice * 1.35));
      options.push({
        id: `trans-flight-${origin.toLowerCase()}-${destinationCity.toLowerCase()}-${eventDate}`,
        provider: 'sample-euro-air',
        mode: 'flight',
        origin,
        destination: destinationCity,
        departureAt: `${eventDate}T13:45:00Z`,
        returnAt: `${nextDay}T14:15:00Z`,
        durationMinutes: flightDuration,
        changes: 0,
        price: flightPrice,
        currency: 'EUR',
        observedAt,
        bookingUrl: `https://www.google.com/travel/flights`,
        operator: 'Regional Express Airline',
      });
    } else {
      // Shorter trip: add a budget bus option (e.g. FlixBus)
      const busDuration = Math.round(trainDuration * 1.7);
      const busPrice = Math.max(15, Math.round(trainPrice * 0.45));
      options.push({
        id: `trans-bus-${origin.toLowerCase()}-${destinationCity.toLowerCase()}-${eventDate}`,
        provider: 'sample-euro-bus',
        mode: 'bus',
        origin,
        destination: destinationCity,
        departureAt: `${eventDate}T09:00:00Z`,
        returnAt: `${nextDay}T08:30:00Z`,
        durationMinutes: busDuration,
        changes: 0,
        price: busPrice,
        currency: 'EUR',
        observedAt,
        bookingUrl: `https://global.flixbus.com`,
        operator: 'Intercity Coach',
      });
    }

    return options;
  }
}

/**
 * Deterministic Sample/Mock Accommodation Provider.
 * Generates realistic hotels/stays close to concert venues.
 */
export class SampleAccommodationProvider implements AccommodationProvider {
  name = 'Sample European Stays';

  async getOptions(
    destinationCity: string,
    eventVenue: string,
    eventDate: string,
    guests = 1,
    now = new Date(),
  ): Promise<AccommodationOption[]> {
    const nextDay = new Date(Date.parse(`${eventDate}T00:00:00Z`) + 86400000)
      .toISOString()
      .slice(0, 10);
    const observedAt = now.toISOString();

    // Option 1: Boutique / Venue-Adjacent Hotel (Close, premium)
    const venueHotelPrice = 115 * Math.max(1, guests);
    const option1: AccommodationOption = {
      id: `stay-close-${destinationCity.toLowerCase()}-${eventDate}`,
      provider: 'sample-stays',
      name: `${destinationCity} Grand Stage Hotel`,
      city: destinationCity,
      checkIn: `${eventDate}T15:00:00Z`,
      checkOut: `${nextDay}T11:00:00Z`,
      guests,
      price: venueHotelPrice,
      currency: 'EUR',
      distanceKmToVenue: 0.8,
      observedAt,
      bookingUrl: `https://www.booking.com`,
    };

    // Option 2: Central Budget Hotel / Design Hostel (Further, cheaper)
    const centralHotelPrice = 68 * Math.max(1, guests);
    const option2: AccommodationOption = {
      id: `stay-central-${destinationCity.toLowerCase()}-${eventDate}`,
      provider: 'sample-stays',
      name: `${destinationCity} Central Hub Suites`,
      city: destinationCity,
      checkIn: `${eventDate}T14:00:00Z`,
      checkOut: `${nextDay}T11:00:00Z`,
      guests,
      price: centralHotelPrice,
      currency: 'EUR',
      distanceKmToVenue: 2.9,
      observedAt,
      bookingUrl: `https://www.booking.com`,
    };

    return [option1, option2];
  }
}
