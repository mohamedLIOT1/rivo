import { registerRootComponent } from 'expo';
import { AppRegistry, LogBox } from 'react-native';
import App from './App';

// Ignore specific warnings
LogBox.ignoreLogs(['ViewPropTypes will be removed', 'Require cycle:']);

// Standard Expo registration
registerRootComponent(App);

// Fallbacks for native side
AppRegistry.registerComponent('main', () => App);
AppRegistry.registerComponent('Liofy', () => App);
