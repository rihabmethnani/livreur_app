import React from 'react';
import { Tabs } from 'expo-router';
import TabBar from '../../components/TabBar';

const TabsLayout = () => {
  return (
    <Tabs 
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false
      }}
    >
      <Tabs.Screen 
        name="runsheet/index" 
        options={{ 
          title: 'Runsheet',
          // Ajoutez cette option pour inclure toutes les routes runsheet
          href: '/runsheet'
        }} 
      />
      {/* <Tabs.Screen 
        name="pickup" 
        options={{ 
          title: 'PickUp',
          href: '/pickup'
        }} 
      /> */}
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: 'Profil',
          href: '/profile'
        }} 
      />
    </Tabs>
  );
};

export default TabsLayout;