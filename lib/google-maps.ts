const GOOGLE_MAPS_APIKEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_APIKEY;

// Straight-line distance fallback (Haversine formula) in meters
const haversineDistance = (
    origin: { lat: number; lng: number },
    dest: { lat: number; lng: number }
): number => {
    const R = 6371000; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(dest.lat - origin.lat);
    const dLng = toRad(dest.lng - origin.lng);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(origin.lat)) * Math.cos(toRad(dest.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export interface DistanceMatrixResponse {
    rows: {
        elements: {
            distance: { text: string; value: number };
            duration: { text: string; value: number };
            status: string;
        }[];
    }[];
    status: string;
}

export const getDistances = async (
    origin: { lat: number; lng: number },
    destinations: { lat: number; lng: number }[]
): Promise<number[]> => {
    if (!destinations.length) return [];

    const destinationString = destinations
        .map((d) => `${d.lat},${d.lng}`)
        .join('|');

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destinationString}&key=${GOOGLE_MAPS_APIKEY}`;

    try {
        const response = await fetch(url);
        const data: DistanceMatrixResponse = await response.json();

        console.log('[GOOGLE API] Response status:', data.status);

        if (data.status !== 'OK') {
            console.warn('[GOOGLE API] Top-level error:', data.status, '— using Haversine fallback');
            return destinations.map((dest) => Math.round(haversineDistance(origin, dest)));
        }

        return data.rows[0].elements.map((el, i) => {
            if (el.status === 'OK') {
                console.log(`[GOOGLE API] Element ${i}: ${el.distance.value}m (driving)`);
                return el.distance.value;
            } else {
                // ZERO_RESULTS or NOT_FOUND — fall back to straight-line distance
                const fallback = Math.round(haversineDistance(origin, destinations[i]));
                console.log(`[GOOGLE API] Element ${i}: ${el.status} → Haversine fallback: ${fallback}m`);
                return fallback;
            }
        });
    } catch (error) {
        console.error('[GOOGLE API] Network error:', error, '— using Haversine fallback');
        return destinations.map((dest) => Math.round(haversineDistance(origin, dest)));
    }
};
