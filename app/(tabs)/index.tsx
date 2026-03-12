import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(location);
    })();
  }, []);

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
        showsUserLocation={true}
        followsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        initialRegion={{
          latitude: location ? location.coords.latitude : 44.9190,
          longitude: location ? location.coords.longitude : -93.2922,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
      </MapView>

      {/* Top UI Elements */}
      <View style={[styles.topContainer, { top: insets.top > 0 ? insets.top + 10 : 40 }]}>
        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.roundButton}>
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
      <View style={styles.leftContainer}>
        <TouchableOpacity style={styles.roundButton}>
          <Ionicons name="shield-checkmark" size={24} color="#0052cc" />
        </TouchableOpacity>
      </View>

      {/* Center Right UI Elements */}
      <View style={styles.rightContainer}>
        <TouchableOpacity style={[styles.roundButton, styles.stackButton]} onPress={centerMap}>
          <MaterialIcons name="my-location" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.roundButton}>
          <Ionicons name="stats-chart" size={20} color="black" />
        </TouchableOpacity>
      </View>

      {/* GO Button */}
      <View style={styles.goButtonContainer}>
        <TouchableOpacity>
          <View style={styles.goButtonOuter}>
            <View style={styles.goButtonInner}>
              <Text style={styles.goButtonText}>GO</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={['12%', '50%']}
        handleIndicatorStyle={{ backgroundColor: '#e0e0e0', width: 40 }}
        backgroundStyle={styles.bottomSheetBackground}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          <TouchableOpacity>
            <Ionicons name="options-outline" size={28} color="black" />
          </TouchableOpacity>
          <Text style={styles.offlineText}>You're offline</Text>
          <TouchableOpacity>
            <Ionicons name="list-outline" size={28} color="black" />
          </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 4,
    alignItems: 'flex-start',
  },
  offlineText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
});
