#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <UserNotifications/UserNotifications.h>

@interface RivoMediaControls : RCTEventEmitter <RCTBridgeModule, UNUserNotificationCenterDelegate>
@end
