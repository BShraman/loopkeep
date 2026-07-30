import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  NavigatorScreenParams,
  CompositeScreenProps,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  BottomTabScreenProps,
  BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import CalendarScreen from '../screens/CalendarScreen';
import AddEditItemScreen from '../screens/AddEditItemScreen';
import ItemDetailScreen from '../screens/ItemDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useTheme } from '../theme/ThemeContext';

export type TabParamList = {
  Dashboard: undefined;
  Add: undefined;
  Calendar: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  AddEditItem: { itemId?: string } | undefined;
  ItemDetail: { itemId: string };
  Settings: undefined;
};

// Screens inside the tabs can navigate both within the tabs and up to the root stack.
export type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Dashboard'>,
  NativeStackScreenProps<RootStackParamList>
>;
export type CalendarScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Calendar'>,
  NativeStackScreenProps<RootStackParamList>
>;
export type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Center "+" button rendered inside the tab bar, aligned between the two tabs.
function AddTabButton({ onPress }: BottomTabBarButtonProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.addSlot}>
      <Pressable
        style={({ pressed }) => [
          styles.addButton,
          { backgroundColor: colors.primary },
          pressed && styles.addButtonPressed,
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Add item"
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>
    </View>
  );
}

// Never actually shown — tab press is intercepted to open the Add screen.
function AddPlaceholder() {
  return null;
}

function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Add"
        component={AddPlaceholder}
        options={{
          tabBarButton: (props) => <AddTabButton {...props} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation
              .getParent<NativeStackNavigationProp<RootStackParamList>>()
              ?.navigate('AddEditItem');
          },
        })}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  addSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -6,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  addButtonPressed: {
    opacity: 0.85,
  },
});

export default function RootNavigator() {
  const { colors, scheme } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="AddEditItem"
          component={AddEditItemScreen}
          options={({ route }) => ({
            title: route.params?.itemId ? 'Edit Item' : 'Add Item',
          })}
        />
        <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: 'Details' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
