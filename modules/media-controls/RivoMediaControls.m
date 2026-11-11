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
    BOOL _isCurrentLive;
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
        [[NSNotificationCenter defaultCenter] addObserver:self
                                                 selector:@selector(handleAudioSessionInterruption:)
                                                     name:AVAudioSessionInterruptionNotification
                                                   object:[AVAudioSession sharedInstance]];
        dispatch_async(dispatch_get_main_queue(), ^{
            [self configureAudioSession];
            [self setupRemoteCommands];
        });
    }
    return self;
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (void)handleAudioSessionInterruption:(NSNotification *)notification {
    NSDictionary *userInfo = notification.userInfo;
    NSNumber *typeValue = userInfo[AVAudioSessionInterruptionTypeKey];
    if (!typeValue) return;

    AVAudioSessionInterruptionType type = (AVAudioSessionInterruptionType)[typeValue unsignedIntegerValue];
    if (type == AVAudioSessionInterruptionTypeBegan) {
        dispatch_async(dispatch_get_main_queue(), ^{
            NSMutableDictionary *now = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy];
            if (now) {
                now[MPNowPlayingInfoPropertyPlaybackRate] = @(0.0);
                [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = now;
            }
        });
        [self sendActionSafely:@"interruption_began"];
    } else if (type == AVAudioSessionInterruptionTypeEnded) {
        NSNumber *optionsValue = userInfo[AVAudioSessionInterruptionOptionKey];
        AVAudioSessionInterruptionOptions options = optionsValue ? (AVAudioSessionInterruptionOptions)[optionsValue unsignedIntegerValue] : 0;
        BOOL shouldResume = (options & AVAudioSessionInterruptionOptionShouldResume) != 0;
        if (shouldResume) {
            @try {
                [[AVAudioSession sharedInstance] setActive:YES error:nil];
            } @catch (NSException *e) {}
            [self sendActionSafely:@"interruption_ended_resume"];
        } else {
            [self sendActionSafely:@"interruption_ended"];
        }
    }
}

- (void)configureAudioSession {
    if (_audioSessionConfigured) return;
    _audioSessionConfigured = YES;
    @try {
        AVAudioSession *session = [AVAudioSession sharedInstance];
        NSError *categoryError = nil;

        [session setCategory:AVAudioSessionCategoryPlayback
                        mode:AVAudioSessionModeDefault
                     options:0
                       error:&categoryError];

        if (categoryError) {
            NSError *fallbackError = nil;
            [session setCategory:AVAudioSessionCategoryPlayback error:&fallbackError];
            if (fallbackError) {
                NSLog(@"[RivoMediaControls] setCategory error: %@", fallbackError.localizedDescription);
            }
        }

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
    __weak typeof(self) weakSelf = self;

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
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf) return MPRemoteCommandHandlerStatusCommandFailed;
        dispatch_async(dispatch_get_main_queue(), ^{
            NSMutableDictionary *now = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
            now[MPNowPlayingInfoPropertyPlaybackRate] = @(1.0);
            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = now;
        });
        [strongSelf sendActionSafely:@"play"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    // Pause Command
    [center.pauseCommand setEnabled:YES];
    [center.pauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf) return MPRemoteCommandHandlerStatusCommandFailed;
        dispatch_async(dispatch_get_main_queue(), ^{
            NSMutableDictionary *now = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
            now[MPNowPlayingInfoPropertyPlaybackRate] = @(0.0);
            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = now;
        });
        [strongSelf sendActionSafely:@"pause"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    // Toggle Play/Pause Command
    [center.togglePlayPauseCommand setEnabled:YES];
    [center.togglePlayPauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf) return MPRemoteCommandHandlerStatusCommandFailed;
        dispatch_async(dispatch_get_main_queue(), ^{
            NSMutableDictionary *now = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
            double currentRate = [now[MPNowPlayingInfoPropertyPlaybackRate] doubleValue];
            BOOL willPlay = (currentRate <= 0.0);
            now[MPNowPlayingInfoPropertyPlaybackRate] = willPlay ? @(1.0) : @(0.0);
            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = now;
        });
        [strongSelf sendActionSafely:@"play_pause"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    // Next Track Command
    [center.nextTrackCommand setEnabled:YES];
    [center.nextTrackCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf) return MPRemoteCommandHandlerStatusCommandFailed;
        [strongSelf sendActionSafely:@"next"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    // Previous Track Command
    [center.previousTrackCommand setEnabled:YES];
    [center.previousTrackCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf) return MPRemoteCommandHandlerStatusCommandFailed;
        [strongSelf sendActionSafely:@"prev"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    // Scrub / Seek Command (Position Slider on Lock Screen and Dynamic Island)
    [center.changePlaybackPositionCommand setEnabled:YES];
    [center.changePlaybackPositionCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf || strongSelf->_isCurrentLive) {
            return MPRemoteCommandHandlerStatusCommandFailed;
        }
        if (![event isKindOfClass:[MPChangePlaybackPositionCommandEvent class]]) {
            return MPRemoteCommandHandlerStatusCommandFailed;
        }
        MPChangePlaybackPositionCommandEvent *posEvent = (MPChangePlaybackPositionCommandEvent *)event;
        double targetSecs = posEvent.positionTime;
        if (isnan(targetSecs) || isinf(targetSecs) || targetSecs < 0.0) {
            targetSecs = 0.0;
        }
        dispatch_async(dispatch_get_main_queue(), ^{
            NSMutableDictionary *now = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
            now[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @(targetSecs);
            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = now;
        });
        [strongSelf sendActionSafely:[NSString stringWithFormat:@"seek:%f", targetSecs]];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    // Like Command
    [center.likeCommand setEnabled:YES];
    [center.likeCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf) return MPRemoteCommandHandlerStatusCommandFailed;
        [strongSelf sendActionSafely:@"like"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];
}

static double sanitizePlaybackSeconds(id rawValue, BOOL allowZero) {
    if (rawValue == nil || [rawValue isKindOfClass:[NSNull class]] || ![rawValue respondsToSelector:@selector(doubleValue)]) {
        return -1.0;
    }
    double val = [rawValue doubleValue];
    if (isnan(val) || isinf(val) || val < 0.0 || (!allowZero && val == 0.0)) {
        return -1.0;
    }
    // Convert millisecond inputs (> 24h) to seconds without truncating valid multi-hour tracks (e.g. 714:59 = 42,899s)
    if (val > 86400.0) {
        double inSec = round(val / 1000.0);
        if (inSec > 0.0 && inSec <= 86400.0) {
            return inSec;
        }
        return -1.0;
    }
    return val;
}

- (void)applyPlaybackOptions:(NSDictionary *)options isInitialShow:(BOOL)isInitialShow {
    if (!options || ![options isKindOfClass:[NSDictionary class]]) return;
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
                self->_isCurrentLive = NO;
                [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nil;
                return;
            }

            id rawIsPlaying = options[@"isPlaying"];
            BOOL isPlaying = (rawIsPlaying != nil && ![rawIsPlaying isKindOfClass:[NSNull class]] && [rawIsPlaying respondsToSelector:@selector(boolValue)])
                ? [rawIsPlaying boolValue]
                : NO;

            NSMutableDictionary *nowPlaying = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
            NSString *prevTitle = nowPlaying[MPMediaItemPropertyTitle];
            NSString *prevArtist = nowPlaying[MPMediaItemPropertyArtist];
            BOOL prevIsLive = [nowPlaying[MPNowPlayingInfoPropertyIsLiveStream] boolValue];

            id rawTitle = options[@"title"];
            NSString *incomingTitle = ([rawTitle isKindOfClass:[NSString class]]) ? (NSString *)rawTitle : nil;
            id rawArtist = options[@"artist"];
            NSString *incomingArtist = ([rawArtist isKindOfClass:[NSString class]]) ? (NSString *)rawArtist : nil;

            BOOL trackChanged = NO;
            if (incomingTitle && incomingTitle.length > 0 && prevTitle && ![incomingTitle isEqualToString:prevTitle]) {
                trackChanged = YES;
            }
            if (incomingArtist && incomingArtist.length > 0 && prevArtist && ![incomingArtist isEqualToString:prevArtist]) {
                trackChanged = YES;
            }

            // Metadata for Lock Screen & Dynamic Island (Now Playing Widget)
            nowPlaying[MPMediaItemPropertyMediaType] = @(MPMediaTypeMusic);

            id rawIsLive = options[@"isLive"];
            BOOL hasIsLive = (rawIsLive != nil && ![rawIsLive isKindOfClass:[NSNull class]] && [rawIsLive respondsToSelector:@selector(boolValue)]);
            BOOL isLive = hasIsLive ? [rawIsLive boolValue] : ((isInitialShow || trackChanged) ? NO : prevIsLive);
            self->_isCurrentLive = isLive;
            nowPlaying[MPNowPlayingInfoPropertyIsLiveStream] = @(isLive);

            [MPRemoteCommandCenter sharedCommandCenter].changePlaybackPositionCommand.enabled = !isLive;

            if (incomingTitle && incomingTitle.length > 0) {
                nowPlaying[MPMediaItemPropertyTitle] = incomingTitle;
            } else if (!prevTitle || prevTitle.length == 0) {
                nowPlaying[MPMediaItemPropertyTitle] = @"Rivo Music";
            }

            if (incomingArtist && incomingArtist.length > 0) {
                nowPlaying[MPMediaItemPropertyArtist] = incomingArtist;
            } else if (!prevArtist || prevArtist.length == 0) {
                nowPlaying[MPMediaItemPropertyArtist] = @"Rivo";
            }

            nowPlaying[MPMediaItemPropertyAlbumTitle] = @"Rivo Music";
            nowPlaying[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? @(1.0) : @(0.0);
            nowPlaying[MPNowPlayingInfoPropertyDefaultPlaybackRate] = @(1.0);

            if (isLive) {
                [nowPlaying removeObjectForKey:MPMediaItemPropertyPlaybackDuration];
                [nowPlaying removeObjectForKey:MPNowPlayingInfoPropertyElapsedPlaybackTime];
            } else {
                double duration = sanitizePlaybackSeconds(options[@"duration"], NO);
                if (duration > 0.0) {
                    nowPlaying[MPMediaItemPropertyPlaybackDuration] = @(duration);
                } else if (isInitialShow || trackChanged || prevIsLive || !nowPlaying[MPMediaItemPropertyPlaybackDuration]) {
                    [nowPlaying removeObjectForKey:MPMediaItemPropertyPlaybackDuration];
                }

                double currentTime = sanitizePlaybackSeconds(options[@"currentTime"], YES);
                if (currentTime >= 0.0) {
                    nowPlaying[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @(currentTime);
                } else if (isInitialShow || trackChanged || prevIsLive) {
                    nowPlaying[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @(0.0);
                }
            }

            // Handle Artwork
            id rawCoverUrl = options[@"coverUrl"];
            NSString *coverUrl = ([rawCoverUrl isKindOfClass:[NSString class]]) ? (NSString *)rawCoverUrl : nil;
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
                    if (self->_currentArtwork && !trackChanged) {
                        nowPlaying[MPMediaItemPropertyArtwork] = self->_currentArtwork;
                    } else if (trackChanged) {
                        self->_currentArtwork = nil;
                        [nowPlaying removeObjectForKey:MPMediaItemPropertyArtwork];
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
            } else if (rawCoverUrl != nil || isInitialShow || trackChanged) {
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

RCT_EXPORT_METHOD(showNotification:(NSDictionary *)options) {
    [self applyPlaybackOptions:options isInitialShow:YES];
}

RCT_EXPORT_METHOD(updatePlayback:(NSDictionary *)options) {
    [self applyPlaybackOptions:options isInitialShow:NO];
}

RCT_EXPORT_METHOD(hideNotification) {
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            self->_isCurrentLive = NO;
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
            if (@available(iOS 14.0, *)) {
                if (settings.authorizationStatus == UNAuthorizationStatusEphemeral) {
                    isAllowed = YES;
                }
            }
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

RCT_EXPORT_METHOD(openNotificationSettings:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSURL *url = [NSURL URLWithString:UIApplicationOpenSettingsURLString];
        if ([[UIApplication sharedApplication] canOpenURL:url]) {
            [[UIApplication sharedApplication] openURL:url options:@{} completionHandler:^(BOOL success) {
                resolve(@(success));
            }];
        } else {
            resolve(@(NO));
        }
    });
}

RCT_EXPORT_METHOD(canDrawOverlays:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@(YES));
}

RCT_EXPORT_METHOD(requestOverlayPermission:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@(YES));
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
