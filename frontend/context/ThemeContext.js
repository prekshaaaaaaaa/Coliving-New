import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Load theme preference from storage
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('themePreference');
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem('themePreference', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const theme = {
    isDarkMode,
    toggleTheme,
    colors: {
      // Light theme colors
      background: isDarkMode ? '#1a1a1a' : '#FFFFFF',
      cardBackground: isDarkMode ? '#2a2a2a' : '#FFFFFF',
  // Make primary text pink in light theme as requested
  text: isDarkMode ? '#FFFFFF' : '#f3439b',
  textSecondary: isDarkMode ? '#B0B0B0' : '#be1f6f',
  label: isDarkMode ? '#f3439b' : '#f3439b', // consistent pink label
      border: isDarkMode ? '#444444' : '#D3D3D3',
      inputBackground: isDarkMode ? '#333333' : '#FFFFFF',
      placeholder: isDarkMode ? '#888888' : '#A9A9A9',
      primary: isDarkMode ? '#f3439b' : '#be1f6fff', // Pink in dark mode
      primaryButton: isDarkMode ? '#f3439b' : '#f3439b', // Pink buttons
      secondaryButton: isDarkMode ? '#f799c0' : '#f25da8ff', // Lighter pink
      header: '#f3439b', // Always pink
      radioSelected: isDarkMode ? '#f3439b' : '#f3439b',
      radioBorder: isDarkMode ? '#f3439b' : '#f3439b',
    },
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

