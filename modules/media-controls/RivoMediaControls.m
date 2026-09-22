#import "RivoMediaControls.h"
#import <MediaPlayer/MediaPlayer.h>
#import <AVFoundation/AVFoundation.h>

static NSCache<NSString *, UIImage *> *sArtworkCache = nil;

static NSData *CreateSilentWavData(void) {
    int sampleRate = 8000;
    int numChannels = 1;
    int bitsPerSample = 8;
    int dataSize = sampleRate * 1; // 1 second
    int fileSize = 36 + dataSize;
    
    NSMutableData *data = [NSMutableData dataWithCapacity:fileSize + 8];
    [data appendBytes:"RIFF" length:4];
    int32_t fSize = fileSize;
    [data appendBytes:&fSize length:4];
    [data appendBytes:"WAVEfmt " length:8];
    int32_t subchunk1Size = 16;
    [data appendBytes:&subchunk1Size length:4];
    int16_t audioFormat = 1; // PCM
    [data appendBytes:&audioFormat length:2];
    int16_t channels = numChannels;
    [data appendBytes:&channels length:2];
    int32_t sRate = sampleRate;
    [data appendBytes:&sRate length:4];
    int32_t byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    [data appendBytes:&byteRate length:4];
    int16_t blockAlign = numChannels * (bitsPerSample / 8);
    [data appendBytes:&blockAlign length:2];
    int16_t bps = bitsPerSample;
    [data appendBytes:&bps length:2];
    [data appendBytes:"data" length:4];
    int32_t dSize = dataSize;
    [data appendBytes:&dSize length:4];
    
    void *silenceBuffer = malloc(dataSize);
    if (silenceBuffer) {
        memset(silenceBuffer, 128, dataSize); // 8-bit PCM silence
        [data appendBytes:silenceBuffer length:dataSize];
        free(silenceBuffer);
    }
    return data;
}

@implementation RivoMediaControls
{
    BOOL _hasListeners;
    BOOL _remoteCommandsConfigured;
    BOOL _audioSessionConfigured;
    NSString *_currentCoverUrl;
    MPMediaItemArtwork *_currentArtwork;
    AVAudioPlayer *_silentPlayer;
}

RCT_EXPORT_MODULE(RivoMediaControls);

+ (void)initialize {
    if (self == [RivoMediaControls class]) {
        sArtworkCache = [[NSCache alloc] init];
        sArtworkCache.countLimit = 50;
    }
}

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
    if (_audioSessionConfigured) return;
    _audioSessionConfigured = YES;
    @try {
        AVAudioSession *session = [AVAudioSession sharedInstance];
        [session setCategory:AVAudioSessionCategoryPlayback
                 withOptions:(AVAudioSessionCategoryOptionAllowBluetooth |
                              AVAudioSessionCategoryOptionAllowBluetoothA2DP |
                              AVAudioSessionCategoryOptionDefaultToSpeaker)
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

    // Disable 10s skip commands so iOS displays Next / Prev track buttons
    center.skipForwardCommand.enabled = NO;
    [center.skipForwardCommand removeTarget:nil];
    center.skipBackwardCommand.enabled = NO;
    [center.skipBackwardCommand removeTarget:nil];
    center.seekForwardCommand.enabled = NO;
    [center.seekForwardCommand removeTarget:nil];
    center.seekBackwardCommand.enabled = NO;
    [center.seekBackwardCommand removeTarget:nil];

    [center.playCommand setEnabled:YES];
    [center.playCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        NSMutableDictionary *now = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
        now[MPNowPlayingInfoPropertyPlaybackRate] = @(1.0);
        [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = now;

        [self sendActionSafely:@"play"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    [center.pauseCommand setEnabled:YES];
    [center.pauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        NSMutableDictionary *now = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
        now[MPNowPlayingInfoPropertyPlaybackRate] = @(0.0);
        [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = now;

        [self sendActionSafely:@"pause"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    [center.togglePlayPauseCommand setEnabled:YES];
    [center.togglePlayPauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        NSMutableDictionary *now = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
        double currentRate = [now[MPNowPlayingInfoPropertyPlaybackRate] doubleValue];
        BOOL willPlay = (currentRate <= 0.0);
        now[MPNowPlayingInfoPropertyPlaybackRate] = willPlay ? @(1.0) : @(0.0);
        [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = now;

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

- (UIImage *)loadImageFromSource:(NSString *)source {
    if (!source || [source length] == 0) return nil;

    // 1. Check in-memory cache
    UIImage *cached = [sArtworkCache objectForKey:source];
    if (cached) return cached;

    // 2. Base64 Data URI
    if ([source hasPrefix:@"data:"]) {
        NSRange commaRange = [source rangeOfString:@","];
        if (commaRange.location != NSNotFound) {
            NSString *base64Str = [source substringFromIndex:commaRange.location + 1];
            NSData *data = [[NSData alloc] initWithBase64EncodedString:base64Str
                                                               options:NSDataBase64DecodingIgnoreUnknownCharacters];
            if (data && [data length] > 0) {
                UIImage *img = [UIImage imageWithData:data];
                if (img) {
                    [sArtworkCache setObject:img forKey:source];
                    return img;
                }
            }
        }
        return nil;
    }

    // 3. Local file path (file:// or /var/... or /private/var/...)
    NSString *filePath = nil;
    if ([source hasPrefix:@"file://"]) {
        NSURL *url = [NSURL URLWithString:source];
        filePath = [url path];
        if (!filePath) {
            filePath = [source substringFromIndex:7];
        }
    } else if ([source hasPrefix:@"/var/"] || [source hasPrefix:@"/private/var/"] || [source hasPrefix:@"/Users/"]) {
        filePath = source;
    }

    if (filePath && [filePath length] > 0) {
        if ([[NSFileManager defaultManager] fileExistsAtPath:filePath]) {
            NSData *data = [NSData dataWithContentsOfFile:filePath];
            if (data && [data length] > 0) {
                UIImage *img = [UIImage imageWithData:data];
                if (img) {
                    [sArtworkCache setObject:img forKey:source];
                    return img;
                }
            }
        }
    }

    // 4. Remote HTTP/HTTPS URL
    NSString *remoteUrl = source;
    if ([remoteUrl hasPrefix:@"//"]) {
        remoteUrl = [@"https:" stringByAppendingString:remoteUrl];
    } else if ([remoteUrl hasPrefix:@"/"]) {
        remoteUrl = [@"https://liofy-production-0f56.up.railway.app" stringByAppendingString:remoteUrl];
    } else if ([remoteUrl hasPrefix:@"http://"]) {
        remoteUrl = [@"https://" stringByAppendingString:[remoteUrl substringFromIndex:7]];
    }

    if ([remoteUrl hasPrefix:@"https://"]) {
        NSString *encoded = [remoteUrl stringByAddingPercentEncodingWithAllowedCharacters:[NSCharacterSet URLQueryAllowedCharacterSet]];
        NSURL *url = [NSURL URLWithString:encoded ?: remoteUrl];
        if (url) {
            NSData *data = [NSData dataWithContentsOfURL:url options:NSDataReadingUncached error:nil];
            if (data && [data length] > 0) {
                UIImage *img = [UIImage imageWithData:data];
                if (img) {
                    [sArtworkCache setObject:img forKey:source];
                    return img;
                }
            }
        }
    }

    return nil;
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

            // Maintain silent background audio session so iOS does not suspend the app
            if (isPlaying) {
                if (!self->_silentPlayer) {
                    NSData *wavData = CreateSilentWavData();
                    NSError *err = nil;
                    self->_silentPlayer = [[AVAudioPlayer alloc] initWithData:wavData error:&err];
                    self->_silentPlayer.numberOfLoops = -1; // Infinite loop
                    self->_silentPlayer.volume = 0.01; // Minimal non-zero volume to keep audio session alive
                }
                [self->_silentPlayer prepareToPlay];
                [self->_silentPlayer play];
            } else {
                if (self->_silentPlayer && [self->_silentPlayer isPlaying]) {
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
                UIImage *existingImg = [sArtworkCache objectForKey:coverUrl];
                if (existingImg) {
                    MPMediaItemArtwork *artwork = [[MPMediaItemArtwork alloc] initWithBoundsSize:existingImg.size requestHandler:^UIImage * _Nonnull(CGSize size) {
                        return existingImg;
                    }];
                    self->_currentArtwork = artwork;
                    self->_currentCoverUrl = [coverUrl copy];
                    nowPlaying[MPMediaItemPropertyArtwork] = artwork;
                } else if (![coverUrl isEqualToString:self->_currentCoverUrl]) {
                    self->_currentCoverUrl = [coverUrl copy];

                    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
                        UIImage *loadedImg = [self loadImageFromSource:coverUrl];
                        if (loadedImg) {
                            MPMediaItemArtwork *artwork = [[MPMediaItemArtwork alloc] initWithBoundsSize:loadedImg.size requestHandler:^UIImage * _Nonnull(CGSize size) {
                                return loadedImg;
                            }];
                            dispatch_async(dispatch_get_main_queue(), ^{
                                if ([coverUrl isEqualToString:self->_currentCoverUrl]) {
                                    self->_currentArtwork = artwork;
                                    NSMutableDictionary *updated = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
                                    updated[MPMediaItemPropertyArtwork] = artwork;
                                    [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = updated;
                                }
                            });
                        }
                    });
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
            NSLog(@"[RivoMediaControls] updatePlayback error: %@", e);
        }
    });
}

RCT_EXPORT_METHOD(hideNotification) {
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            if (self->_silentPlayer) {
                [self->_silentPlayer stop];
                self->_silentPlayer = nil;
            }
            self->_currentCoverUrl = nil;
            self->_currentArtwork = nil;
            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nil;
        } @catch (NSException *e) {}
    });
}

@end
