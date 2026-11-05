#import "RivoMediaControls.h"
#import "RivoArtworkLoader.h"
#import <MediaPlayer/MediaPlayer.h>
#import <AVFoundation/AVFoundation.h>
#import <UserNotifications/UserNotifications.h>

@implementation RivoMediaControls
{
    BOOL _hasListeners;
    BOOL _remoteCommandsConfigured;
    BOOL _audioSessionConfigured;
    NSString *_currentCoverUrl;
    MPMediaItemArtwork *_currentArtwork;
}

RCT_EXPORT_MODULE(RivoMediaControls);

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"onMediaAction", @"onOpenChatFromNotification"];
}

- (void)startObserving {
    _hasListeners = YES;
}

- (void)stopObserving {
    _hasListeners = NO;
}

- (instancetype)init {
    if (self = [super init]) {
        dispatch_async(dispatch_get_main_queue(), ^{
            [self configureAudioSession];
            [self setupRemoteCommands];
        });
    }
    return self;
}

- (void)configureAudioSession {
    if (_audioSessionConfigured) return;
    _audioSessionConfigured = YES;
    @try {
        AVAudioSession *session = [AVAudioSession sharedInstance];
        NSError *categoryError = nil;
        AVAudioSessionCategoryOptions options = AVAudioSessionCategoryOptionAllowBluetooth |
                                                AVAudioSessionCategoryOptionAllowBluetoothA2DP;
        if (@available(iOS 10.0, *)) {
            options |= AVAudioSessionCategoryOptionAllowAirPlay;
        }

        [session setCategory:AVAudioSessionCategoryPlayback
                 withOptions:options
                       error:&categoryError];

        if (categoryError) {
            NSLog(@"[RivoMediaControls] setCategory error: %@", categoryError.localizedDescription);
        }

        [session setMode:AVAudioSessionModeDefault error:nil];
        [session setActive:YES error:nil];
        [[UIApplication sharedApplication] beginReceivingRemoteControlEvents];
    } @catch (NSException *e) {
        NSLog(@"[RivoMediaControls] AudioSession configure exception: %@", e);
    }
}

- (void)sendActionSafely:(NSString *)action {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (self->_hasListeners) {
            @try {
                [self sendEventWithName:@"onMediaAction" body:action];
            } @catch (NSException *e) {
                NSLog(@"[RivoMediaControls] sendActionSafely exception: %@", e);
            }
        }
    });
}

- (void)setupRemoteCommands {
    if (_remoteCommandsConfigured) return;
    _remoteCommandsConfigured = YES;

    MPRemoteCommandCenter *center = [MPRemoteCommandCenter sharedCommandCenter];

    // Remove any previously registered targets to prevent duplicate handler invocation
    [center.playCommand removeTarget:nil];
    [center.pauseCommand removeTarget:nil];
    [center.togglePlayPauseCommand removeTarget:nil];
    [center.nextTrackCommand removeTarget:nil];
    [center.previousTrackCommand removeTarget:nil];
    [center.changePlaybackPositionCommand removeTarget:nil];
    [center.likeCommand removeTarget:nil];

    // Disable unused skip/seek buttons so standard Prev/Next buttons appear on Lock Screen & Dynamic Island
    center.skipForwardCommand.enabled = NO;
    [center.skipForwardCommand removeTarget:nil];
    center.skipBackwardCommand.enabled = NO;
    [center.skipBackwardCommand removeTarget:nil];
    center.seekForwardCommand.enabled = NO;
    [center.seekForwardCommand removeTarget:nil];
    center.seekBackwardCommand.enabled = NO;
    [center.seekBackwardCommand removeTarget:nil];

    // Play Command
    [center.playCommand setEnabled:YES];
    [center.playCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        dispatch_async(dispatch_get_main_queue(), ^{
            NSMutableDictionary *now = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
            now[MPNowPlayingInfoPropertyPlaybackRate] = @(1.0);
            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = now;
        });
        [self sendActionSafely:@"play"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    // Pause Command
    [center.pauseCommand setEnabled:YES];
    [center.pauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        dispatch_async(dispatch_get_main_queue(), ^{
            NSMutableDictionary *now = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
            now[MPNowPlayingInfoPropertyPlaybackRate] = @(0.0);
            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = now;
        });
        [self sendActionSafely:@"pause"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    // Toggle Play/Pause Command
    [center.togglePlayPauseCommand setEnabled:YES];
    [center.togglePlayPauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        dispatch_async(dispatch_get_main_queue(), ^{
            NSMutableDictionary *now = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
            double currentRate = [now[MPNowPlayingInfoPropertyPlaybackRate] doubleValue];
            BOOL willPlay = (currentRate <= 0.0);
            now[MPNowPlayingInfoPropertyPlaybackRate] = willPlay ? @(1.0) : @(0.0);
            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = now;
        });
        [self sendActionSafely:@"play_pause"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    // Next Track Command
    [center.nextTrackCommand setEnabled:YES];
    [center.nextTrackCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        [self sendActionSafely:@"next"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    // Previous Track Command
    [center.previousTrackCommand setEnabled:YES];
    [center.previousTrackCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        [self sendActionSafely:@"prev"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    // Scrub / Seek Command (Position Slider on Lock Screen and Dynamic Island)
    [center.changePlaybackPositionCommand setEnabled:YES];
    [center.changePlaybackPositionCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        MPChangePlaybackPositionCommandEvent *posEvent = (MPChangePlaybackPositionCommandEvent *)event;
        if (posEvent) {
            double targetSecs = posEvent.positionTime;
            dispatch_async(dispatch_get_main_queue(), ^{
                NSMutableDictionary *now = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
                now[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @(targetSecs);
                [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = now;
            });
            [self sendActionSafely:[NSString stringWithFormat:@"seek:%f", targetSecs]];
        }
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    // Like Command
    [center.likeCommand setEnabled:YES];
    [center.likeCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        [self sendActionSafely:@"like"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];
}

RCT_EXPORT_METHOD(showNotification:(NSDictionary *)options) {
    [self updatePlayback:options];
}

RCT_EXPORT_METHOD(updatePlayback:(NSDictionary *)options) {
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            [self configureAudioSession];
            [self setupRemoteCommands];

            BOOL isLockscreenEnabled = YES;
            NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
            if ([defaults objectForKey:@"rivo_lockscreen_enabled"] != nil) {
                isLockscreenEnabled = [defaults boolForKey:@"rivo_lockscreen_enabled"];
            }

            if (!isLockscreenEnabled) {
                [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nil;
                return;
            }

            BOOL isPlaying = [options[@"isPlaying"] boolValue];
            NSMutableDictionary *nowPlaying = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];

            // Metadata for Lock Screen & Dynamic Island (Now Playing Widget)
            nowPlaying[MPMediaItemPropertyMediaType] = @(MPMediaTypeMusic);
            nowPlaying[MPNowPlayingInfoPropertyIsLiveStream] = @(NO);

            NSString *title = options[@"title"];
            nowPlaying[MPMediaItemPropertyTitle] = (title && title.length > 0) ? title : @"Rivo Music";

            NSString *artist = options[@"artist"];
            nowPlaying[MPMediaItemPropertyArtist] = (artist && artist.length > 0) ? artist : @"Rivo";

            nowPlaying[MPMediaItemPropertyAlbumTitle] = @"Rivo Music";

            nowPlaying[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? @(1.0) : @(0.0);
            nowPlaying[MPNowPlayingInfoPropertyDefaultPlaybackRate] = @(1.0);

            double duration = [options[@"duration"] doubleValue];
            if (duration > 10000.0) duration = round(duration / 1000.0);
            nowPlaying[MPMediaItemPropertyPlaybackDuration] = @(duration > 0 ? duration : 240.0);

            if (options[@"currentTime"] != nil && ![options[@"currentTime"] isKindOfClass:[NSNull class]]) {
                double currentTime = [options[@"currentTime"] doubleValue];
                if (currentTime > 10000.0) currentTime = round(currentTime / 1000.0);
                if (currentTime >= 0) {
                    nowPlaying[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @(currentTime);
                }
            }

            // Handle Artwork
            NSString *coverUrl = options[@"coverUrl"];
            if (coverUrl && coverUrl.length > 0) {
                UIImage *cachedImg = [RivoArtworkLoader cachedImageForSource:coverUrl];
                if (cachedImg) {
                    MPMediaItemArtwork *artwork = [[MPMediaItemArtwork alloc] initWithBoundsSize:cachedImg.size requestHandler:^UIImage * _Nonnull(CGSize size) {
                        return cachedImg;
                    }];
                    self->_currentArtwork = artwork;
                    self->_currentCoverUrl = [coverUrl copy];
                    nowPlaying[MPMediaItemPropertyArtwork] = artwork;
                } else if (![coverUrl isEqualToString:self->_currentCoverUrl]) {
                    self->_currentCoverUrl = [coverUrl copy];
                    if (self->_currentArtwork) {
                        nowPlaying[MPMediaItemPropertyArtwork] = self->_currentArtwork;
                    }

                    [RivoArtworkLoader loadImageWithSource:coverUrl completion:^(UIImage * _Nullable loadedImg) {
                        if (loadedImg && [coverUrl isEqualToString:self->_currentCoverUrl]) {
                            MPMediaItemArtwork *artwork = [[MPMediaItemArtwork alloc] initWithBoundsSize:loadedImg.size requestHandler:^UIImage * _Nonnull(CGSize size) {
                                return loadedImg;
                            }];
                            self->_currentArtwork = artwork;
                            NSMutableDictionary *updated = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
                            updated[MPMediaItemPropertyArtwork] = artwork;
                            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = updated;
                        }
                    }];
                } else if (self->_currentArtwork) {
                    nowPlaying[MPMediaItemPropertyArtwork] = self->_currentArtwork;
                }
            } else {
                self->_currentCoverUrl = nil;
                self->_currentArtwork = nil;
                [nowPlaying removeObjectForKey:MPMediaItemPropertyArtwork];
            }

            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nowPlaying;
        } @catch (NSException *e) {
            NSLog(@"[RivoMediaControls] updatePlayback exception: %@", e);
        }
    });
}

RCT_EXPORT_METHOD(hideNotification) {
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            self->_currentCoverUrl = nil;
            self->_currentArtwork = nil;
            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nil;
        } @catch (NSException *e) {}
    });
}

RCT_EXPORT_METHOD(checkNotificationPermission:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    if (@available(iOS 10.0, *)) {
        [[UNUserNotificationCenter currentNotificationCenter] getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings * _Nonnull settings) {
            BOOL isAllowed = (settings.authorizationStatus == UNAuthorizationStatusAuthorized ||
                              settings.authorizationStatus == UNAuthorizationStatusProvisional);
            resolve(@(isAllowed));
        }];
    } else {
        resolve(@(YES));
    }
}

RCT_EXPORT_METHOD(requestNotificationPermission:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    if (@available(iOS 10.0, *)) {
        UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
        center.delegate = self;
        [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge)
                              completionHandler:^(BOOL granted, NSError * _Nullable error) {
            resolve(@(granted));
        }];
    } else {
        resolve(@(YES));
    }
}

RCT_EXPORT_METHOD(showChatNotification:(NSDictionary *)options) {
    if (@available(iOS 10.0, *)) {
        UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
        center.delegate = self;
        [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge) completionHandler:^(BOOL granted, NSError * _Nullable error) {
            if (!granted) return;

            dispatch_async(dispatch_get_main_queue(), ^{
                NSString *senderId = options[@"senderId"] ?: @"unknown";
                NSString *senderName = options[@"senderName"] ?: @"Friend";
                NSString *message = options[@"message"] ?: @"";
                BOOL isJam = [options[@"isJam"] boolValue];

                UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
                content.title = isJam ? [NSString stringWithFormat:@"📻 Jam Session • %@", senderName] : [NSString stringWithFormat:@"💬 %@", senderName];
                content.body = message;
                content.sound = [UNNotificationSound defaultSound];
                content.userInfo = options;

                NSString *identifier = [NSString stringWithFormat:@"rivo_chat_%@", senderId];
                UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:identifier content:content trigger:nil];

                [center addNotificationRequest:request withCompletionHandler:nil];
            });
        }];
    }
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions options))completionHandler {
    if (@available(iOS 14.0, *)) {
        completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionSound | UNNotificationPresentationOptionBadge);
    } else {
        completionHandler(UNNotificationPresentationOptionAlert | UNNotificationPresentationOptionSound | UNNotificationPresentationOptionBadge);
    }
}

RCT_EXPORT_METHOD(dismissChatNotification:(NSString *)senderId) {
    if (@available(iOS 10.0, *)) {
        NSString *identifier = [NSString stringWithFormat:@"rivo_chat_%@", senderId ?: @""];
        [[UNUserNotificationCenter currentNotificationCenter] removeDeliveredNotificationsWithIdentifiers:@[identifier]];
    }
}

RCT_EXPORT_METHOD(dismissAllChatNotifications) {
    if (@available(iOS 10.0, *)) {
        [[UNUserNotificationCenter currentNotificationCenter] removeAllDeliveredNotifications];
    }
}

RCT_EXPORT_METHOD(setLockScreenEnabled:(BOOL)enabled) {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    [defaults setBool:enabled forKey:@"rivo_lockscreen_enabled"];
    [defaults synchronize];
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!enabled) {
            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nil;
        }
    });
}

RCT_EXPORT_METHOD(isLockScreenEnabled:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
    id val = [defaults objectForKey:@"rivo_lockscreen_enabled"];
    BOOL enabled = (val != nil) ? [defaults boolForKey:@"rivo_lockscreen_enabled"] : YES;
    resolve(@(enabled));
}

@end
