import React, { createContext, useContext, useState, useEffect } from 'react';
import { Address } from '../types';
import { getItem, setItem } from '../services/storage';
import { getCurrentLocation } from '../services/location';

interface LocationContextType {
  currentAddress: Address;
  setAddress: (addr: Address) => void;
  savedAddresses: Address[];
  addSavedAddress: (addr: Address) => void;
  fetchCurrentLocation: () => Promise<void>;
  isFetchingLocation: boolean;
}

const DEFAULT_ADDRESS: Address = {
  label: 'Home',
  street: 'KSS Metro Tech Park, Sector 4',
  city: 'Bengaluru',
  zip: '560102',
  latitude: 12.9716,
  longitude: 77.5946,
  isDefault: true,
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentAddress, setCurrentAddress] = useState<Address>(DEFAULT_ADDRESS);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([DEFAULT_ADDRESS]);
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(false);

  useEffect(() => {
    loadLocation();
  }, []);

  const loadLocation = async () => {
    const saved = await getItem<Address>('grabit_location');
    if (saved) setCurrentAddress(saved);

    const savedList = await getItem<Address[]>('grabit_addresses');
    if (savedList && Array.isArray(savedList)) setSavedAddresses(savedList);
  };

  const setAddress = async (addr: Address) => {
    setCurrentAddress(addr);
    await setItem('grabit_location', addr);
  };

  const addSavedAddress = async (addr: Address) => {
    const updated = [...savedAddresses, addr];
    setSavedAddresses(updated);
    await setItem('grabit_addresses', updated);
  };

  const fetchCurrentLocation = async () => {
    setIsFetchingLocation(true);
    try {
      const coords = await getCurrentLocation();
      if (coords) {
        const newAddr: Address = {
          label: 'Current Location',
          street: coords.addressName || 'GPS Location',
          city: 'Local Area',
          zip: '000000',
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        await setAddress(newAddr);
      }
    } finally {
      setIsFetchingLocation(false);
    }
  };

  return (
    <LocationContext.Provider
      value={{
        currentAddress,
        setAddress,
        savedAddresses,
        addSavedAddress,
        fetchCurrentLocation,
        isFetchingLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocation must be used within LocationProvider');
  return context;
};
