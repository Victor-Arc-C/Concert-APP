'use client';
import { frenchCityGroups, internationalCities } from '@/domain/catalog';
import { useI18n } from '@/i18n/client';

/** Shared origin/destination choices, grouped so provincial towns are easy to find. */
export function CityOptions({ excluded = [] }: { excluded?: string[] }) {
  const { t, city } = useI18n();
  return (
    <>
      {frenchCityGroups.map((group) => (
        <optgroup key={group.region} label={group.region}>
          {group.cities
            .filter((c) => !excluded.includes(c.name))
            .map((c) => (
              <option key={c.name} value={c.name}>
                {city(c.name)}
              </option>
            ))}
        </optgroup>
      ))}
      <optgroup label={t.prefs.otherEurope}>
        {internationalCities
          .filter((c) => !excluded.includes(c.name))
          .map((c) => (
            <option key={c.name} value={c.name}>
              {city(c.name)}
            </option>
          ))}
      </optgroup>
    </>
  );
}
