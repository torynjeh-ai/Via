import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import VerifyOtpScreen from '../screens/auth/VerifyOtpScreen';
import SetupProfileScreen from '../screens/SetupProfileScreen';
import DashboardScreen from '../screens/DashboardScreen';
import GroupsScreen from '../screens/GroupsScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import ContributeScreen from '../screens/ContributeScreen';
import PayoutsScreen from '../screens/PayoutsScreen';
import ReceiptScreen from '../screens/ReceiptScreen';
import WalletScreen from '../screens/WalletScreen';
import TopUpScreen from '../screens/TopUpScreen';
import WithdrawScreen from '../screens/WithdrawScreen';
import TransferScreen from '../screens/TransferScreen';
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ReceiptsScreen from '../screens/ReceiptsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      tabBarIcon: ({ color, size }) => {
        const icons = { Home: 'home', Groups: 'people', Notifications: 'notifications', Receipts: 'receipt', Wallet: 'wallet', Profile: 'person' };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
      },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.subtext,
      headerShown: false,
    })}>
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Groups" component={GroupsScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Receipts" component={ReceiptsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="VerifyOtp" component={VerifyOtpScreen} />
    </Stack.Navigator>
  );
}

function SetupStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SetupProfile" component={SetupProfileScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.primary }}>
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: 'Group Details' }} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ title: 'Create Group' }} />
      <Stack.Screen name="Contribute" component={ContributeScreen} options={{ title: 'Contribute' }} />
      <Stack.Screen name="Payouts" component={PayoutsScreen} options={{ title: 'Payout Queue' }} />
      <Stack.Screen name="Receipt" component={ReceiptScreen} options={{ title: 'Receipt' }} />
      <Stack.Screen name="TopUp" component={TopUpScreen} options={{ title: 'Top Up Wallet' }} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} options={{ title: 'Withdraw TC' }} />
      <Stack.Screen name="Transfer" component={TransferScreen} options={{ title: 'Send TC' }} />
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} options={{ title: 'Transaction History' }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <NavigationContainer>
      {!user ? <AuthStack /> : !user.profile_complete ? <SetupStack /> : <AppStack />}
    </NavigationContainer>
  );
}
