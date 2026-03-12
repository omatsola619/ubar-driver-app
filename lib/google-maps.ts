const GOOGLE_MAPS_APIKEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_APIKEY;

export interface DistanceMatrixResponse {
    rows: {
        elements: {
            distance: {
                text: string;
                value: number;
            };
            duration: {
                text: string;
                value: number;
            };
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

        if (data.status !== 'OK') {
            console.error('Distance Matrix API error:', data.status);
            return [];
        }

        return data.rows[0].elements.map((el) => el.status === 'OK' ? el.distance.value : -1);
    } catch (error) {
        console.error('Error fetching distances:', error);
        return [];
    }
};
