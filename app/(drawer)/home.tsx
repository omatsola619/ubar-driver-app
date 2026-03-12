import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const { user } = useAuth();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const animatedPosition = useSharedValue(0);
  const screenHeight = Dimensions.get('window').height;

  const animatedButtonStyle = useAnimatedStyle(() => {
    // animatedPosition is the position from the top of the screen
    // We want to calculate the offset from the bottom
    const marginBottom = Math.max(0, screenHeight - animatedPosition.value - 20);
    return {
      bottom: marginBottom + 140, // 140 is the original bottom offset
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

  // Update Supabase with driver's current position and status
  const updateDriverStatus = async (online: boolean) => {
    if (!user || !location) return;

    const payload = {
      user_id: user.id,
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      is_available: online,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('drivers')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      console.error('Error updating driver status:', error.message);
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
      </MapView>

      {/* Top UI Elements */}
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

      {/* Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={[isOnline ? (300 + (insets.bottom || 20)) : (100 + (insets.bottom || 20)), '50%']}
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
  stopButtonOuter: {
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
    borderColor: 'rgba(239, 68, 68, 0.6)',
  },
  stopButtonInner: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
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
});
