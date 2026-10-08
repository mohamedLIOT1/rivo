import { registerRootComponent } from 'expo';
import { AppRegistry, LogBox } from 'react-native';
import App from './App';

LogBox.ignoreLogs(['ViewPropTypes will be removed', 'Require cycle:']);

registerRootComponent(App);

AppRegistry.registerComponent('main', () => App);
AppRegistry.registerComponent('Rivo', () => App);
