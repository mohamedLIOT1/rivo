#import "RivoMediaControls.h"
#import <MediaPlayer/MediaPlayer.h>
#import <AVFoundation/AVFoundation.h>

static NSCache<NSString *, UIImage *> *sArtworkCache = nil;

static NSData *createSilentWAVData(void) {
    uint32_t sampleRate = 44100;
    uint16_t numChannels = 1;
    uint16_t bitsPerSample = 16;
    uint32_t dataSize = sampleRate * numChannels * (bitsPerSample / 8); // 88200 bytes = 1 sec
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
            [self ensureSilentPlayer];
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

- (void)ensureSilentPlayer {
    if (!_silentPlayer) {
        @try {
            NSData *silentData = createSilentWAVData();
            NSError *err = nil;
            _silentPlayer = [[AVAudioPlayer alloc] initWithData:silentData error:&err];
            _silentPlayer.numberOfLoops = -1; // Infinite loop keeps iOS background session alive
            _silentPlayer.volume = 0.0001f;   // Completely silent to human ear but holds audio hardware pipeline
            [_silentPlayer prepareToPlay];
            [_silentPlayer play];
        } @catch (NSException *e) {
            NSLog(@"[RivoMediaControls] ensureSilentPlayer error: %@", e);
        }
    } else if (!_silentPlayer.isPlaying) {
        @try {
            [_silentPlayer play];
        } @catch (NSException *e) {}
    }
}

- (void)sendActionSafely:(NSString *)action {
    @try {
        if (_hasListeners) {
            [self sendEventWithName:@"onMediaAction" body:action];
        }
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

    // Explicitly disable 10s skip and seek commands so iOS always displays Next/Prev track buttons
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
        [self ensureSilentPlayer];
        NSMutableDictionary *now = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
        now[MPNowPlayingInfoPropertyPlaybackRate] = @(1.0);
        [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = now;

        [self sendActionSafely:@"play"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    [center.pauseCommand setEnabled:YES];
    [center.pauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        [self ensureSilentPlayer];
        NSMutableDictionary *now = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
        now[MPNowPlayingInfoPropertyPlaybackRate] = @(0.0);
        [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = now;

        [self sendActionSafely:@"pause"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    [center.togglePlayPauseCommand setEnabled:YES];
    [center.togglePlayPauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        [self ensureSilentPlayer];
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
        [self ensureSilentPlayer];
        [self sendActionSafely:@"next"];
        return MPRemoteCommandHandlerStatusSuccess;
    }];

    [center.previousTrackCommand setEnabled:YES];
    [center.previousTrackCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
        [self ensureSilentPlayer];
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
            [self ensureSilentPlayer];

            // Maintain silent background audio keeper continuously so iOS never suspends WebView or background audio
            if (self->_silentPlayer && !self->_silentPlayer.isPlaying) {
                [self->_silentPlayer play];
            }

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

            // Normalize cover URL (handle relative /api or /covers URLs, protocol-relative //, and http)
            NSString *rawCover = options[@"coverUrl"];
            NSString *coverUrl = nil;
            if (rawCover && [rawCover length] > 0) {
                if ([rawCover hasPrefix:@"//"]) {
                    coverUrl = [@"https:" stringByAppendingString:rawCover];
                } else if ([rawCover hasPrefix:@"/"]) {
                    coverUrl = [@"https://liofy-production-0f56.up.railway.app" stringByAppendingString:rawCover];
                } else if ([rawCover hasPrefix:@"http://"]) {
                    coverUrl = [@"https://" stringByAppendingString:[rawCover substringFromIndex:7]];
                } else {
                    coverUrl = rawCover;
                }
            }

            if (coverUrl && [coverUrl length] > 0) {
                // Check in-memory cache first for instant synchronous lock screen artwork
                UIImage *cachedImg = [sArtworkCache objectForKey:coverUrl];
                if (cachedImg) {
                    MPMediaItemArtwork *artwork = [[MPMediaItemArtwork alloc] initWithBoundsSize:cachedImg.size requestHandler:^UIImage * _Nonnull(CGSize size) {
                        return cachedImg;
                    }];
                    self->_currentArtwork = artwork;
                    self->_currentCoverUrl = [coverUrl copy];
                    nowPlaying[MPMediaItemPropertyArtwork] = artwork;
                } else if (![coverUrl isEqualToString:self->_currentCoverUrl]) {
                    // Reset artwork so previous track's cover is never displayed for this track
                    self->_currentCoverUrl = [coverUrl copy];
                    self->_currentArtwork = nil;
                    [nowPlaying removeObjectForKey:MPMediaItemPropertyArtwork];

                    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
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
                                    NSURLRequest *req = [NSURLRequest requestWithURL:url cachePolicy:NSURLRequestReturnCacheDataElseLoad timeoutInterval:8.0];
                                    NSURLResponse *resp = nil;
                                    NSError *err = nil;
                                    imageData = [NSURLConnection sendSynchronousRequest:req returningResponse:&resp error:&err];
                                }
                            }

                            if (imageData && [imageData length] > 0) {
                                UIImage *image = [UIImage imageWithData:imageData];
                                if (image) {
                                    [sArtworkCache setObject:image forKey:coverUrl];
                                    MPMediaItemArtwork *artwork = [[MPMediaItemArtwork alloc] initWithBoundsSize:image.size requestHandler:^UIImage * _Nonnull(CGSize size) {
                                        return image;
                                    }];
                                    self->_currentArtwork = artwork;
                                    dispatch_async(dispatch_get_main_queue(), ^{
                                        if ([coverUrl isEqualToString:self->_currentCoverUrl]) {
                                            NSMutableDictionary *updated = [[MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo mutableCopy] ?: [NSMutableDictionary dictionary];
                                            updated[MPMediaItemPropertyArtwork] = artwork;
                                            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = updated;
                                        }
                                    });
                                }
                            }
                        } @catch (NSException *e) {
                            NSLog(@"[RivoMediaControls] Artwork download error: %@", e);
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
            if (self->_silentPlayer && self->_silentPlayer.isPlaying) {
                [self->_silentPlayer stop];
            }
            self->_currentCoverUrl = nil;
            self->_currentArtwork = nil;
            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nil;
        } @catch (NSException *e) {}
    });
}

@end
