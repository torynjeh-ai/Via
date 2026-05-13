/**
 * useLocation hook
 *
 * Requests browser geolocation when the user is logged in.
 * - Reverse geocodes GPS → city/country via OpenStreetMap Nominatim (free, no key)
 * - Sends coordinates + city/country to the backend
 * - Shows a warning banner if the user denies and they are an admin
 */

import { useEffect, useState } from 'react';
import { updateLocation } from '../api/users';

const reverseGeocode = async (lat, lon) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'ViaApp/1.0' } }
    );
    const data = await res.json();
    return {
      city:    data.address?.city || data.address?.town || data.address?.village || data.address?.county || null,
      country: data.address?.country || null,
    };
  } catch {
    return { city: null, country: null };
  }
};

export function useLocation(user) {
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | granted | denied | unavailable

  useEffect(() => {
    if (!user) return;
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const { city, country } = await reverseGeocode(latitude, longitude);

        try {
          await updateLocation({ latitude, longitude, city, country });
        } catch {
          // Silent fail — location update is best-effort
        }

        setLocationStatus('granted');
      },
      () => {
        setLocationStatus('denied');
      },
      { timeout: 10000, maximumAge: 5 * 60 * 1000 } // cache for 5 min
    );
  }, [user?.id]);

  return locationStatus;
}
