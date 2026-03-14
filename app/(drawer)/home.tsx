import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { getDistances, reverseGeocode } from '@/lib/google-maps';
import { supabase } from '@/lib/supabase';

const GOOGLE_MAPS_APIKEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_APIKEY;

interface LatLng {
  latitude: number;
  longitude: number;
}

interface AcceptedRide {
  id: string;
  rider_id: string;
  pickup_lat: number;
  pickup_lng: number;
  destination_lat: number;
  destination_lng: number;
  price?: number;
  distance?: string;
  resolvedPickupAddress?: string;
}

export default function HomeScreen() {
  const { user, session } = useAuth();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nearbyRides, setNearbyRides] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [acceptingRideId, setAcceptingRideId] = useState<string | null>(null);
  const [decliningRideId, setDecliningRideId] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);

  // Accepted ride state
  const [acceptedRide, setAcceptedRide] = useState<AcceptedRide | null>(null);
  const [riderName, setRiderName] = useState<string | null>(null);
  const [riderPhone, setRiderPhone] = useState<string | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [pickupEta, setPickupEta] = useState<string | null>(null);
  const [pickupDistance, setPickupDistance] = useState<string | null>(null);

  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const riderSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const animatedPosition = useSharedValue(0);
  const screenHeight = Dimensions.get('window').height;

  const animatedButtonStyle = useAnimatedStyle(() => {
    const marginBottom = Math.max(0, screenHeight - animatedPosition.value - 20);
    return {
      bottom: marginBottom + 140,
    };
  });

  useEffect(() => {
    let locationSub: Location.LocationSubscription | null = null;
    let headingSub: Location.LocationSubscription | null = null;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      locationSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 2000,
          distanceInterval: 1,
        },
        (loc) => {
          setLocation((prevLoc) => {
            return {
              ...loc,
              coords: {
                ...loc.coords,
                heading: loc.coords.heading !== null && loc.coords.heading >= 0
                  ? loc.coords.heading
                  : (prevLoc?.coords.heading ?? 0)
              }
            };
          });
        }
      );

      headingSub = await Location.watchHeadingAsync((headingObj) => {
        setLocation((prevLoc) => {
          if (!prevLoc) return prevLoc;
          return {
            ...prevLoc,
            coords: {
              ...prevLoc.coords,
              heading: headingObj.trueHeading >= 0 ? headingObj.trueHeading : headingObj.magHeading,
            }
          };
        });
      });
    })();

    return () => {
      if (locationSub) locationSub.remove();
      if (headingSub) headingSub.remove();
    };
  }, []);

  // Fetch initial driver status on mount
  useEffect(() => {
    const fetchInitialStatus = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching driver status:', error.message);
      } else if (data && data.length > 0) {
        console.log('[DEBUG] Driver data fetched:', data[0]);
        setIsOnline(data[0].is_available);
        setDriverId(data[0].id); // This is the UUID/ID from the drivers table
      }
    };
    fetchInitialStatus();
  }, [user]);

  const updateDriverStatus = async (online: boolean) => {
    if (!user || !location) return;

    const payload = {
      user_id: user.id,
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      is_available: online,
      updated_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from('drivers')
      .insert(payload);

    if (insertError) {
      const { data, error: updateError } = await supabase
        .from('drivers')
        .update(payload)
        .eq('user_id', user.id)
        .select();

      if (updateError) {
        console.error('Error updating driver status:', updateError.message);
      } else if (data && data.length > 0) {
        setDriverId(data[0].id);
      }
    } else {
      // Row inserted successfully
      const { data, error: selectError } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!selectError && data) {
        setDriverId(data.id);
      }
    }
  };

  const toggleOnline = async () => {
    setLoading(true);
    const nextStatus = !isOnline;
    await updateDriverStatus(nextStatus);
    setIsOnline(nextStatus);
    setLoading(false);
  };

  // Heartbeat location updates every 5 seconds when online
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    if (isOnline) {
      intervalId = setInterval(async () => {
        await updateDriverStatus(true);
      }, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOnline, location, user]);

  // Fetch and filter rides when online
  useEffect(() => {
    let subscription: any = null;
    let driverChannel: any = null;

    const fetchRides = async () => {
      if (!isOnline || !location) {
        setNearbyRides([]);
        setIsModalVisible(false);
        return;
      }

      const { data: ridesData, error } = await supabase
        .from('rides')
        .select('*')
        .eq('status', 'searching');

      if (error) {
        console.error('[RIDES] Error fetching rides:', error.message);
        return;
      }

      if (ridesData && ridesData.length > 0) {
        const destinations = ridesData.map((r: any) => ({ lat: r.pickup_lat, lng: r.pickup_lng }));
        const distances = await getDistances(
          { lat: location.coords.latitude, lng: location.coords.longitude },
          destinations
        );

        const geocodedRides = await Promise.all(
          ridesData.map(async (ride: any, index: number) => {
            const [pickupAddress, destinationAddress] = await Promise.all([
              reverseGeocode(ride.pickup_lat, ride.pickup_lng),
              reverseGeocode(ride.destination_lat, ride.destination_lng),
            ]);
            return {
              ...ride,
              resolvedPickupAddress: pickupAddress,
              resolvedDestinationAddress: destinationAddress,
              distanceInMeters: distances[index],
              distanceFromDriver: distances[index] >= 0
                ? `${(distances[index] / 1000).toFixed(1)} km`
                : 'N/A',
            };
          })
        );

        const nearby = geocodedRides.filter((ride: any) => ride.distanceInMeters >= 0 && ride.distanceInMeters <= 5000);

        setNearbyRides(nearby);
        setIsModalVisible(nearby.length > 0 && !acceptedRide);
      } else {
        setNearbyRides([]);
        setIsModalVisible(false);
      }
    };

    if (isOnline && session?.access_token) {
      supabase.realtime.setAuth(session.access_token);
      fetchRides();

      driverChannel = supabase
        .channel(`topic:drivers:${user?.id}`)
        .on('broadcast', { event: 'new-ride' }, () => { fetchRides(); })
        .subscribe();

      subscription = supabase
        .channel('rides-channel')
        .on(
          'postgres_changes' as any,
          { event: '*', table: 'rides' as any, schema: 'public' },
          (payload: any) => {
            // If a ride that was being shown gets cancelled by the rider, remove it immediately
            if (
              payload.eventType === 'UPDATE' &&
              payload.new?.status === 'cancelled'
            ) {
              const cancelledId = payload.new?.id;
              setNearbyRides((prev) => {
                const updated = prev.filter((r) => r.id !== cancelledId);
                if (updated.length === 0) setIsModalVisible(false);
                return updated;
              });
            } else {
              fetchRides();
            }
          }
        )
        .subscribe();
    } else {
      setNearbyRides([]);
      setIsModalVisible(false);
    }

    return () => {
      if (subscription) supabase.removeChannel(subscription);
      if (driverChannel) supabase.removeChannel(driverChannel);
    };
  }, [isOnline, location?.coords.latitude, location?.coords.longitude, session?.access_token]);

  // Collapse bottom sheet when ride cards are showing, restore when gone
  useEffect(() => {
    if (nearbyRides.length > 0 && isModalVisible) {
      bottomSheetRef.current?.collapse();
    } else if (!acceptedRide) {
      bottomSheetRef.current?.snapToIndex(0);
    }
  }, [nearbyRides.length, isModalVisible]);

  // Fetch route from driver location to pickup
  const fetchRoute = async (driverLat: number, driverLng: number, pickupLat: number, pickupLng: number) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${driverLat},${driverLng}&destination=${pickupLat},${pickupLng}&key=${GOOGLE_MAPS_APIKEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const leg = data.routes[0].legs[0];
        setPickupEta(leg.duration.text);
        setPickupDistance(leg.distance.text);

        // Decode polyline points
        const points = decodePolyline(data.routes[0].overview_polyline.points);
        setRouteCoords(points);

        // Fit map to show route
        if (mapRef.current && points.length > 0) {
          mapRef.current.fitToCoordinates(points, {
            edgePadding: { top: 120, right: 60, bottom: 320, left: 60 },
            animated: true,
          });
        }
      }
    } catch (err) {
      console.error('[ROUTE] Error fetching directions:', err);
    }
  };

  // Decode Google encoded polyline
  const decodePolyline = (encoded: string): LatLng[] => {
    const poly: LatLng[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return poly;
  };

  // Fetch rider profile info
  const fetchRiderProfile = async (riderId: string) => {
    try {
      // Try profiles table first
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', riderId)
        .single();

      if (!error && data) {
        setRiderName(data.full_name || 'Rider');
        setRiderPhone(data.phone || null);
        return;
      }

      // Fallback: try users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('full_name, phone')
        .eq('id', riderId)
        .single();

      if (!userError && userData) {
        setRiderName(userData.full_name || 'Rider');
        setRiderPhone(userData.phone || null);
      } else {
        setRiderName('Rider');
      }
    } catch {
      setRiderName('Rider');
    }
  };

  // Handle declining a ride → set status to 'cancelled'
  const handleDeclineRide = async (rideId: string) => {
    console.log('--- DECLINE BUTTON CLICKED ---');
    console.log('RIDE ID:', rideId);
    setDecliningRideId(rideId);
    try {
      await supabase
        .from('rides')
        .update({ status: 'cancelled' })
        .eq('id', rideId);

      // Remove from local list immediately
      setNearbyRides((prev) => {
        const updated = prev.filter((r) => r.id !== rideId);
        if (updated.length === 0) setIsModalVisible(false);
        return updated;
      });
    } catch (err) {
      console.error('[DECLINE] Error declining ride:', err);
    } finally {
      setDecliningRideId(null);
    }
  };

  // Handle accepting a ride
  const handleAcceptRide = async (ride: any) => {
    console.log('--- ACCEPT BUTTON CLICKED ---');
    console.log('RIDE ID:', ride.id);
    if (!user) {
      console.warn('[ACCEPT] No user found in AuthContext');
      return;
    }
    console.log('USER ID (Auth):', user.id);
    console.log('DRIVER ID (DB Primary Key):', driverId);
    setAcceptingRideId(ride.id);

    // Switch to using user.id by default, as the foreign key error suggests
    // it points to auth.users (the Auth ID) rather than the drivers table primary key.
    const driverIdentifier = user.id;

    console.log('[ACCEPT] Attempting to accept ride:', ride.id);
    console.log('[ACCEPT] Using Auth ID as driver_id:', driverIdentifier);

    try {
      console.log('[ACCEPT] Updating Supabase...');
      const { data, error } = await supabase
        .from('rides')
        .update({
          status: 'accepted',
          driver_id: driverIdentifier,
        })
        .eq('id', ride.id)
        .select();

      console.log('[ACCEPT] Supabase response data:', data);

      if (error) {
        console.error('[ACCEPT] Error accepting ride:', error.message);
        setAcceptingRideId(null);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('[ACCEPT] Update succeeded but no rows were affected. Is the ride ID correct?');
      }

      // Dismiss the ride request modal
      setIsModalVisible(false);
      setNearbyRides([]);
      setAcceptingRideId(null);

      // Store accepted ride info
      setAcceptedRide({
        id: ride.id,
        rider_id: ride.rider_id,
        pickup_lat: ride.pickup_lat,
        pickup_lng: ride.pickup_lng,
        destination_lat: ride.destination_lat,
        destination_lng: ride.destination_lng,
        price: ride.price,
        distance: ride.distance,
        resolvedPickupAddress: ride.resolvedPickupAddress,
      });

      // Fetch rider profile
      await fetchRiderProfile(ride.rider_id);

      // Draw route from driver to pickup
      if (location) {
        await fetchRoute(
          location.coords.latitude,
          location.coords.longitude,
          ride.pickup_lat,
          ride.pickup_lng
        );
      }

      // Snap rider bottom sheet up
      riderSheetRef.current?.snapToIndex(0);
    } catch (err) {
      console.error('[ACCEPT] Unexpected error:', err);
      setAcceptingRideId(null);
    }
  };

  const centerMap = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={false}
        followsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        initialRegion={{
          latitude: location ? location.coords.latitude : 44.9190,
          longitude: location ? location.coords.longitude : -93.2922,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
          >
            <View style={styles.markerWrapper}>
              <View style={styles.customMarker}>
                <Ionicons
                  name="navigate"
                  size={20}
                  color="black"
                  style={{
                    marginLeft: 0,
                    marginBottom: 0,
                    transform: [{ rotate: `${(location.coords.heading || 0) - 45}deg` }]
                  }}
                />
              </View>
            </View>
          </Marker>
        )}

        {/* Nearby ride pickup markers (when no ride accepted yet) */}
        {!acceptedRide && nearbyRides.map((ride) => (
          <Marker
            key={ride.id}
            coordinate={{
              latitude: ride.pickup_lat,
              longitude: ride.pickup_lng,
            }}
            title="Pickup"
            description={ride.pickup_address}
          >
            <View style={styles.rideMarker}>
              <MaterialCommunityIcons name="car-connected" size={24} color="white" />
            </View>
          </Marker>
        ))}

        {/* Accepted ride: pickup marker */}
        {acceptedRide && (
          <Marker
            coordinate={{
              latitude: acceptedRide.pickup_lat,
              longitude: acceptedRide.pickup_lng,
            }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.pickupMarker}>
              <Ionicons name="person" size={16} color="white" />
            </View>
          </Marker>
        )}

        {/* Route polyline: driver → pickup */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#111111"
            strokeWidth={5}
            lineDashPattern={[0]}
          />
        )}
      </MapView>

      {/* Pickup address banner (when ride accepted) */}
      {acceptedRide && (
        <View style={[styles.pickupBanner, { top: insets.top > 0 ? insets.top + 10 : 50 }]}>
          <Ionicons name="location" size={20} color="white" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pickupBannerTitle} numberOfLines={1}>
              Pickup
            </Text>
            <Text style={styles.pickupBannerAddress} numberOfLines={2}>
              {acceptedRide.resolvedPickupAddress || `${acceptedRide.pickup_lat.toFixed(4)}, ${acceptedRide.pickup_lng.toFixed(4)}`}
            </Text>
          </View>
        </View>
      )}

      {/* Top UI Elements (hidden during accepted ride) */}
      {!acceptedRide && (
        <View style={[styles.topContainer, { top: insets.top > 0 ? insets.top + 10 : 40 }]}>
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.roundButton} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
              <Ionicons name="menu" size={24} color="black" />
            </TouchableOpacity>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>57</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.earningsPill}>
            <Text style={styles.currency}>$</Text>
            <Text style={styles.earningsText}>93.66</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.roundButton}>
            <Ionicons name="search" size={24} color="black" />
          </TouchableOpacity>
        </View>
      )}

      {/* Center Left UI Element */}
      <Animated.View style={[styles.leftContainer, animatedButtonStyle]}>
        <TouchableOpacity style={styles.roundButton}>
          <Ionicons name="shield-checkmark" size={24} color="#0052cc" />
        </TouchableOpacity>
      </Animated.View>

      {/* Center Right UI Elements */}
      <Animated.View style={[styles.rightContainer, animatedButtonStyle]}>
        <TouchableOpacity style={[styles.roundButton, styles.stackButton]} onPress={centerMap}>
          <MaterialIcons name="my-location" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.roundButton}>
          <Ionicons name="stats-chart" size={20} color="black" />
        </TouchableOpacity>
      </Animated.View>

      {/* GO Button (Only when offline) */}
      {!isOnline && (
        <View style={styles.goButtonContainer}>
          <TouchableOpacity onPress={toggleOnline} disabled={loading}>
            <View style={styles.goButtonOuter}>
              <View style={styles.goButtonInner}>
                {loading ? (
                  <ActivityIndicator color="white" size="large" />
                ) : (
                  <Text style={styles.goButtonText}>GO</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Sheet (driver status — hidden when ride accepted) */}
      {!acceptedRide && (
        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={[isOnline ? (300 + (insets.bottom || 20)) : (100 + (insets.bottom || 20)), '50%']}
          enableDynamicSizing={false}
          handleIndicatorStyle={{ backgroundColor: '#e0e0e0', width: 40 }}
          backgroundStyle={styles.bottomSheetBackground}
          animatedPosition={animatedPosition}
          enableHandlePanningGesture={isOnline}
          enableContentPanningGesture={isOnline}
        >
          <BottomSheetView style={[styles.bottomSheetContent, { paddingBottom: insets.bottom || 20 }]}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity>
                <Ionicons name="options-outline" size={28} color="black" />
              </TouchableOpacity>
              <Text style={styles.offlineText}>{isOnline ? "You're online" : "You're offline"}</Text>
              <TouchableOpacity>
                <Ionicons name="list-outline" size={28} color="black" />
              </TouchableOpacity>
            </View>

            {isOnline && (
              <View style={styles.onlineStatsContainer}>
                <View style={styles.statsRow}>
                  <View style={styles.leftStats}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statsTitle}>Unlock Gold</Text>
                  </View>
                  <View style={styles.rightStats}>
                    <MaterialCommunityIcons
                      name="diamond"
                      size={22}
                      color="#3b82f6"
                      style={styles.statsIcon}
                    />
                    <Text style={styles.pointsText}>185 / 300 pts</Text>
                  </View>
                </View>

                <View style={styles.progressSection}>
                  <View style={styles.statDetail}>
                    <Text style={styles.statPercent}>71%</Text>
                    <Ionicons name="person" size={12} color="#666" />
                  </View>
                  <View style={styles.statDetail}>
                    <Text style={styles.statPercent}>2%</Text>
                    <Ionicons name="speedometer-outline" size={12} color="#666" />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.stopButton, loading && { opacity: 0.7 }]}
                  onPress={toggleOnline}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.stopButtonText}>STOP</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </BottomSheetView>
        </BottomSheet>
      )}

      {/* Rider Bottom Sheet (shown after accepting a ride) */}
      {acceptedRide && (
        <BottomSheet
          ref={riderSheetRef}
          index={0}
          snapPoints={[220 + (insets.bottom || 20)]}
          enableDynamicSizing={false}
          handleIndicatorStyle={{ backgroundColor: '#e0e0e0', width: 40 }}
          backgroundStyle={styles.bottomSheetBackground}
          enableHandlePanningGesture={false}
          enableContentPanningGesture={false}
        >
          <BottomSheetView style={[styles.riderSheetContent, { paddingBottom: insets.bottom || 20 }]}>
            {/* ETA row */}
            <View style={styles.riderEtaRow}>
              <TouchableOpacity style={styles.etaFilterBtn}>
                <Ionicons name="options-outline" size={20} color="#555" />
              </TouchableOpacity>
              <View style={styles.etaCenter}>
                {pickupEta ? (
                  <Text style={styles.etaText}>{pickupEta}</Text>
                ) : (
                  <ActivityIndicator size="small" color="#333" />
                )}
                {pickupDistance && (
                  <>
                    <View style={styles.etaDot} />
                    <Ionicons name="leaf" size={14} color="#22c55e" />
                    <Text style={styles.etaDistanceText}>{pickupDistance}</Text>
                  </>
                )}
              </View>
              <TouchableOpacity style={styles.etaFilterBtn}>
                <Ionicons name="list-outline" size={20} color="#555" />
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Rider info row */}
            <View style={styles.riderInfoRow}>
              {/* Call button */}
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => {
                  if (riderPhone) {
                    Linking.openURL(`tel:${riderPhone}`);
                  }
                }}
              >
                <Ionicons name="call" size={22} color="white" />
              </TouchableOpacity>

              {/* Rider name */}
              <Text style={styles.riderNameText}>
                {riderName ?? 'Loading...'}
              </Text>

              {/* Rider avatar */}
              <View style={styles.riderAvatar}>
                <Ionicons name="person" size={26} color="#555" />
              </View>
            </View>

            {/* Start button */}
            <TouchableOpacity style={styles.startButton}>
              <View style={styles.startButtonArrow}>
                <Ionicons name="arrow-forward" size={22} color="white" />
              </View>
              <Text style={styles.startButtonText}>Start UberX</Text>
            </TouchableOpacity>
          </BottomSheetView>
        </BottomSheet>
      )}

      {/* Nearby Ride Request Cards */}
      {isOnline && nearbyRides.length > 0 && isModalVisible && !acceptedRide && (
        <View style={styles.modalOverlay}>
          <Animated.FlatList
            data={nearbyRides}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.rideCard}>
                {/* Card Header: ride type + close */}
                <View style={styles.rideCardHeader}>
                  <View style={styles.rideTypeRow}>
                    <View style={styles.rideTypeBadge}>
                      <Ionicons name="person" size={14} color="white" />
                      <Text style={styles.rideTypeText}>UberX</Text>
                    </View>
                    <Text style={styles.exclusiveLabel}>Exclusive</Text>
                  </View>
                  <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                    <Ionicons name="close" size={22} color="#333" />
                  </TouchableOpacity>
                </View>

                {/* Fare in Naira */}
                <Text style={styles.fareText}>
                  {item.price ? `₦${Number(item.price).toLocaleString()}` : 'Calculating...'}
                </Text>

                {/* Rating */}
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color="#f59e0b" />
                  <Text style={styles.ratingText}>{item.rating ?? '4.80'}</Text>
                  {item.distance ? (
                    <Text style={[styles.ratingText, { marginLeft: 12, color: '#3b82f6' }]}>
                      {item.distance}
                    </Text>
                  ) : null}
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Pickup row */}
                <View style={styles.tripRow}>
                  <View style={styles.tripDotWrapper}>
                    <View style={styles.tripDotFilled} />
                    <View style={styles.tripLine} />
                  </View>
                  <View style={styles.tripTextWrapper}>
                    <Text style={styles.tripMeta}>{item.distanceFromDriver} away</Text>
                    <Text style={styles.tripAddress} numberOfLines={2}>
                      {item.resolvedPickupAddress || item.pickup_address || `${item.pickup_lat?.toFixed(4)}, ${item.pickup_lng?.toFixed(4)}`}
                    </Text>
                  </View>
                </View>

                {/* Dropoff row */}
                <View style={styles.tripRow}>
                  <View style={styles.tripDotWrapper}>
                    <View style={styles.tripDotSquare} />
                  </View>
                  <View style={styles.tripTextWrapper}>
                    <Text style={styles.tripMeta}>
                      {item.distance ? `${item.distance} trip` : 'Trip'}
                    </Text>
                    <Text style={styles.tripAddress} numberOfLines={2}>
                      {item.resolvedDestinationAddress || item.dropoff_address || `${item.destination_lat?.toFixed(4)}, ${item.destination_lng?.toFixed(4)}`}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  {/* Decline */}
                  <TouchableOpacity
                    style={[styles.declineButton, decliningRideId === item.id && styles.actionButtonLoading]}
                    onPress={() => handleDeclineRide(item.id)}
                    disabled={acceptingRideId !== null || decliningRideId !== null}
                  >
                    {decliningRideId === item.id ? (
                      <ActivityIndicator color="#ef4444" size="small" />
                    ) : (
                      <Text style={styles.declineText}>Decline</Text>
                    )}
                  </TouchableOpacity>

                  {/* Accept */}
                  <TouchableOpacity
                    style={[styles.acceptButton, acceptingRideId === item.id && styles.acceptButtonLoading]}
                    onPress={() => handleAcceptRide(item)}
                    disabled={acceptingRideId !== null || decliningRideId !== null}
                  >
                    {acceptingRideId === item.id ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={styles.acceptText}>Accept</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerWrapper: {
    padding: -8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customMarker: {
    width: 33,
    height: 33,
    borderRadius: 18,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'black',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  pickupMarker: {
    backgroundColor: '#3b82f6',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  pickupBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#111',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  pickupBannerTitle: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  pickupBannerAddress: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  topContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  menuContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    minWidth: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    paddingHorizontal: 4,
    zIndex: 2,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  roundButton: {
    width: 52,
    height: 52,
    backgroundColor: 'white',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  stackButton: {
    marginBottom: 16,
  },
  earningsPill: {
    flexDirection: 'row',
    backgroundColor: 'black',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  currency: {
    color: '#4ade80',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 2,
  },
  earningsText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  leftContainer: {
    position: 'absolute',
    bottom: 140,
    left: 16,
    zIndex: 10,
  },
  rightContainer: {
    position: 'absolute',
    bottom: 140,
    right: 16,
    zIndex: 10,
  },
  goButtonContainer: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    zIndex: 10,
  },
  goButtonOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(59, 130, 246, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.6)',
  },
  goButtonInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  goButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  bottomSheetBackground: {
    borderRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 10,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  offlineText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  onlineStatsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leftStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ef4444',
    marginRight: 10,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  rightStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsIcon: {
    width: 20,
    height: 20,
    marginRight: 6,
    resizeMode: 'contain',
  },
  pointsText: {
    fontSize: 16,
    color: '#444',
    fontWeight: '500',
  },
  progressSection: {
    flexDirection: 'row',
    paddingLeft: 24,
  },
  statDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statPercent: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
  },
  stopButton: {
    backgroundColor: '#000',
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Rider bottom sheet styles
  riderSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  riderEtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  etaFilterBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  etaCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  etaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  etaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#999',
  },
  etaDistanceText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  riderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  callButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  riderNameText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111',
    flex: 1,
    textAlign: 'center',
  },
  riderAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ddd',
  },
  startButton: {
    backgroundColor: '#111',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  startButtonArrow: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  startButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  // Ride request modal
  modalOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '55%',
    zIndex: 200,
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  rideCard: {
    backgroundColor: 'white',
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  rideCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  rideTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rideTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  rideTypeText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
  exclusiveLabel: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  fareText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 14,
  },
  ratingText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 14,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tripDotWrapper: {
    alignItems: 'center',
    width: 16,
    marginRight: 12,
    paddingTop: 3,
  },
  tripDotFilled: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111',
  },
  tripLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#ccc',
    marginTop: 3,
    minHeight: 20,
  },
  tripDotSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#111',
  },
  tripTextWrapper: {
    flex: 1,
  },
  tripMeta: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  tripAddress: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  acceptButtonLoading: {
    opacity: 0.75,
  },
  acceptText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row' as const,
    gap: 10,
    marginTop: 6,
  },
  declineButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  actionButtonLoading: {
    opacity: 0.65,
  },
  declineText: {
    color: '#ef4444',
    fontSize: 17,
    fontWeight: 'bold' as const,
  },
  rideMarker: {
    backgroundColor: '#3b82f6',
    padding: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
