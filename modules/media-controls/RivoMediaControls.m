#import "RivoMediaControls.h"
#import <MediaPlayer/MediaPlayer.h>
#import <AVFoundation/AVFoundation.h>

static NSData *createSilentWAVData(void) {
    uint32_t sampleRate = 44100;
    uint16_t numChannels = 1;
    uint16_t bitsPerSample = 16;
    uint32_t dataSize = sampleRate * numChannels * (bitsPerSample / 8); // 88200 bytes = 1 second
    uint32_t chunkSize = 36 + dataSize;
    uint32_t byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    uint16_t blockAlign = numChannels * (bitsPerSample / 8);

    NSMutableData *data = [NSMutableData dataWithCapacity:(44 + dataSize)];
    [data appendBytes:"RIFF" length:4];
    [data appendBytes:&chunkSize length:4];
    [data appendBytes:"WAVE" length:4];

    [data appendBytes:"fmt " length:4];
    uint32_t subchunk1Size = 16;
    uint16_t audioFormat = 1; // PCM
    [data appendBytes:&subchunk1Size length:4];
    [data appendBytes:&audioFormat length:2];
    [data appendBytes:&numChannels length:2];
    [data appendBytes:&sampleRate length:4];
    [data appendBytes:&byteRate length:4];
    [data appendBytes:&blockAlign length:2];
    [data appendBytes:&bitsPerSample length:2];

    [data appendBytes:"data" length:4];
    [data appendBytes:&dataSize length:4];

    void *zeroes = calloc(1, dataSize);
    if (zeroes) {
        [data appendBytes:zeroes length:dataSize];
        free(zeroes);
    }
    return data;
}

@implementation RivoMediaControls
{
    BOOL _hasListeners;
    AVAudioPlayer *_silentPlayer;
    BOOL _remoteCommandsConfigured;
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
            [self ensureSilentPlayer];
        });
    }
    return self;
}

- (void)configureAudioSession {
    @try {
        AVAudioSession *session = [AVAudioSession sharedInstance];
        [session setCategory:AVAudioSessionCategoryPlayback
                 withOptions:(AVAudioSessionCategoryOptionMixWithOthers | AVAudioSessionCategoryOptionAllowBluetooth | AVAudioSessionCategoryOptionAllowBluetoothA2DP)
                       error:nil];
        [session setActive:YES error:nil];
        [[UIApplication sharedApplication] beginReceivingRemoteControlEvents];
    } @catch (NSException *e) {}
}

- (void)ensureSilentPlayer {
    if (!_silentPlayer) {
        @try {
            NSData *silentData = createSilentWAVData();
            NSError *err = nil;
            _silentPlayer = [[AVAudioPlayer alloc] initWithData:silentData error:&err];
            _silentPlayer.numberOfLoops = -1; // Infinite loop
            _silentPlayer.volume = 0.001f;    // Minimal non-zero volume keeps audio session pipeline active
            [_silentPlayer prepareToPlay];
        } @catch (NSException *e) {}
    }
}

- (void)setupRemoteCommands {
    if (_remoteCommandsConfigured) return;
    _remoteCommandsConfigured = YES;

    MPRemoteCommandCenter *center = [MPRemoteCommandCenter sharedCommandCenter];

    [center.playCommand setEnabled:YES];
    [center.playCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        [self ensureSilentPlayer];
        [self->_silentPlayer play];

        NSMutableDictionary *info = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
        info[MPNowPlayingInfoPropertyPlaybackRate] = @(1.0);
        [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = info;

        if (self->_hasListeners) {
            [self sendEventWithName:@"onMediaAction" body:@"play"];
        }
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    [center.pauseCommand setEnabled:YES];
    [center.pauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        if (self->_silentPlayer) {
            [self->_silentPlayer pause];
        }

        NSMutableDictionary *info = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
        info[MPNowPlayingInfoPropertyPlaybackRate] = @(0.0);
        [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = info;

        if (self->_hasListeners) {
            [self sendEventWithName:@"onMediaAction" body:@"pause"];
        }
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    [center.togglePlayPauseCommand setEnabled:YES];
    [center.togglePlayPauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        BOOL willPlay = !(self->_silentPlayer && self->_silentPlayer.isPlaying);
        if (willPlay) {
            [self ensureSilentPlayer];
            [self->_silentPlayer play];
        } else {
            if (self->_silentPlayer) {
                [self->_silentPlayer pause];
            }
        }

        NSMutableDictionary *info = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
        info[MPNowPlayingInfoPropertyPlaybackRate] = willPlay ? @(1.0) : @(0.0);
        [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = info;

        if (self->_hasListeners) {
            [self sendEventWithName:@"onMediaAction" body:willPlay ? @"play" : @"pause"];
        }
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    [center.nextTrackCommand setEnabled:YES];
    [center.nextTrackCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        if (self->_hasListeners) {
            [self sendEventWithName:@"onMediaAction" body:@"next"];
        }
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    [center.previousTrackCommand setEnabled:YES];
    [center.previousTrackCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        if (self->_hasListeners) {
            [self sendEventWithName:@"onMediaAction" body:@"prev"];
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
            [self ensureSilentPlayer];

            BOOL isPlaying = [options[@"isPlaying"] boolValue];
            if (isPlaying) {
                if (!self->_silentPlayer.isPlaying) {
                    [self->_silentPlayer play];
                }
            } else {
                if (self->_silentPlayer.isPlaying) {
                    [self->_silentPlayer pause];
                }
            }

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

            double duration = [options[@"duration"] doubleValue];
            if (duration > 0) {
                nowPlaying[MPMediaItemPropertyPlaybackDuration] = @(duration);
            } else if (!nowPlaying[MPMediaItemPropertyPlaybackDuration]) {
                nowPlaying[MPMediaItemPropertyPlaybackDuration] = @(240.0);
            }

            double currentTime = [options[@"currentTime"] doubleValue];
            if (currentTime > 0) {
                nowPlaying[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @(currentTime);
            }

            NSString *coverUrl = options[@"coverUrl"];
            if (coverUrl && [coverUrl length] > 0) {
                dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
                    @try {
                        NSData *data = nil;
                        if ([coverUrl hasPrefix:@"file://"]) {
                            data = [NSData dataWithContentsOfURL:[NSURL URLWithString:coverUrl]];
                        } else if ([coverUrl hasPrefix:@"http"]) {
                            data = [NSData dataWithContentsOfURL:[NSURL URLWithString:coverUrl]];
                        }
                        if (data) {
                            UIImage *image = [UIImage imageWithData:data];
                            if (image) {
                                MPMediaItemArtwork *artwork = [[MPMediaItemArtwork alloc] initWithBoundsSize:image.size requestHandler:^UIImage * _Nonnull(CGSize size) {
                                    return image;
                                }];
                                dispatch_async(dispatch_get_main_queue(), ^{
                                    NSMutableDictionary *updated = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
                                    updated[MPMediaItemPropertyArtwork] = artwork;
                                    [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = updated;
                                });
                            }
                        }
                    } @catch (NSException *e) {}
                });
            }

            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nowPlaying;
        } @catch (NSException *e) {}
    });
}

RCT_EXPORT_METHOD(hideNotification) {
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            if (self->_silentPlayer) {
                [self->_silentPlayer stop];
            }
            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nil;
        } @catch (NSException *e) {}
    });
}

@end
