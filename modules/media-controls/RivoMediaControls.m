#import "RivoMediaControls.h"
#import <MediaPlayer/MediaPlayer.h>
#import <AVFoundation/AVFoundation.h>

@implementation RivoMediaControls
{
    BOOL _hasListeners;
    BOOL _remoteCommandsConfigured;
    NSString *_currentCoverUrl;
    MPMediaItemArtwork *_currentArtwork;
}

RCT_EXPORT_MODULE(RivoMediaControls);

- (NSArray<NSString *> *)supportedEvents {
    return @[@"onMediaAction"];
}

- (void)startObserving {
    _hasListeners = YES;
}

- (void)stopObserving {
    _hasListeners = NO;
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
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
    @try {
        AVAudioSession *session = [AVAudioSession sharedInstance];
        [session setCategory:AVAudioSessionCategoryPlayback
                 withOptions:(AVAudioSessionCategoryOptionAllowBluetooth | AVAudioSessionCategoryOptionAllowBluetoothA2DP)
                       error:nil];
        [session setActive:YES error:nil];
        [[UIApplication sharedApplication] beginReceivingRemoteControlEvents];
    } @catch (NSException *e) {
        NSLog(@"[RivoMediaControls] AudioSession configure error: %@", e);
    }
}

- (void)sendActionSafely:(NSString *)action {
    @try {
        [self sendEventWithName:@"onMediaAction" body:action];
    } @catch (NSException *e) {
        NSLog(@"[RivoMediaControls] sendActionSafely error: %@", e);
    }
}

- (void)setupRemoteCommands {
    if (_remoteCommandsConfigured) return;
    _remoteCommandsConfigured = YES;

    MPRemoteCommandCenter *center = [MPRemoteCommandCenter sharedCommandCenter];

    [center.playCommand removeTarget:nil];
    [center.pauseCommand removeTarget:nil];
    [center.togglePlayPauseCommand removeTarget:nil];
    [center.nextTrackCommand removeTarget:nil];
    [center.previousTrackCommand removeTarget:nil];
    [center.changePlaybackPositionCommand removeTarget:nil];

    [center.playCommand setEnabled:YES];
    [center.playCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        [self sendActionSafely:@"play"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    [center.pauseCommand setEnabled:YES];
    [center.pauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        [self sendActionSafely:@"pause"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    [center.togglePlayPauseCommand setEnabled:YES];
    [center.togglePlayPauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        [self sendActionSafely:@"play_pause"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    [center.nextTrackCommand setEnabled:YES];
    [center.nextTrackCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        [self sendActionSafely:@"next"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    [center.previousTrackCommand setEnabled:YES];
    [center.previousTrackCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        [self sendActionSafely:@"prev"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    [center.changePlaybackPositionCommand setEnabled:YES];
    [center.changePlaybackPositionCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        MPChangePlaybackPositionCommandEvent *posEvent = (MPChangePlaybackPositionCommandEvent *)event;
        if (posEvent) {
            [self sendActionSafely:[NSString stringWithFormat:@"seek:%f", posEvent.positionTime]];
        }
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

            BOOL isPlaying = [options[@"isPlaying"] boolValue];

            NSMutableDictionary *nowPlaying = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];

            NSString *title = options[@"title"];
            if (title && [title length] > 0) {
                nowPlaying[MPMediaItemPropertyTitle] = title;
            } else if (!nowPlaying[MPMediaItemPropertyTitle]) {
                nowPlaying[MPMediaItemPropertyTitle] = @"Rivo Music";
            }

            NSString *artist = options[@"artist"];
            if (artist && [artist length] > 0) {
                nowPlaying[MPMediaItemPropertyArtist] = artist;
            } else if (!nowPlaying[MPMediaItemPropertyArtist]) {
                nowPlaying[MPMediaItemPropertyArtist] = @"Rivo";
            }

            nowPlaying[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? @(1.0) : @(0.0);
            nowPlaying[MPNowPlayingInfoPropertyDefaultPlaybackRate] = @(1.0);

            double duration = [options[@"duration"] doubleValue];
            if (duration > 0) {
                nowPlaying[MPMediaItemPropertyPlaybackDuration] = @(duration);
            } else if (!nowPlaying[MPMediaItemPropertyPlaybackDuration]) {
                nowPlaying[MPMediaItemPropertyPlaybackDuration] = @(240.0);
            }

            double currentTime = [options[@"currentTime"] doubleValue];
            nowPlaying[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @(currentTime >= 0 ? currentTime : 0.0);

            NSString *coverUrl = options[@"coverUrl"];
            if (coverUrl && [coverUrl length] > 0) {
                if (![coverUrl isEqualToString:self->_currentCoverUrl]) {
                    self->_currentCoverUrl = [coverUrl copy];
                    self->_currentArtwork = nil;

                    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
                        @try {
                            NSData *imageData = nil;
                            if ([coverUrl hasPrefix:@"file://"]) {
                                NSURL *url = [NSURL URLWithString:coverUrl];
                                if (url) {
                                    imageData = [NSData dataWithContentsOfURL:url];
                                }
                            }
                            if (!imageData && [coverUrl hasPrefix:@"/"]) {
                                imageData = [NSData dataWithContentsOfFile:coverUrl];
                            }
                            if (!imageData && [coverUrl hasPrefix:@"http"]) {
                                NSString *encoded = [coverUrl stringByAddingPercentEncodingWithAllowedCharacters:[NSCharacterSet URLQueryAllowedCharacterSet]];
                                NSURL *url = [NSURL URLWithString:encoded ?: coverUrl];
                                if (url) {
                                    imageData = [NSData dataWithContentsOfURL:url];
                                }
                            }

                            if (imageData && [imageData length] > 0) {
                                UIImage *image = [UIImage imageWithData:imageData];
                                if (image) {
                                    MPMediaItemArtwork *artwork = [[MPMediaItemArtwork alloc] initWithBoundsSize:image.size requestHandler:^UIImage * _Nonnull(CGSize size) {
                                        return image;
                                    }];
                                    self->_currentArtwork = artwork;
                                    dispatch_async(dispatch_get_main_queue(), ^{
                                        NSMutableDictionary *updated = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
                                        updated[MPMediaItemPropertyArtwork] = artwork;
                                        [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = updated;
                                    });
                                }
                            }
                        } @catch (NSException *e) {
                            NSLog(@"[RivoMediaControls] Artwork load error: %@", e);
                        }
                    });
                } else if (self->_currentArtwork) {
                    nowPlaying[MPMediaItemPropertyArtwork] = self->_currentArtwork;
                }
            }

            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nowPlaying;
        } @catch (NSException *e) {
            NSLog(@"[RivoMediaControls] updatePlayback error: %@", e);
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

@end
