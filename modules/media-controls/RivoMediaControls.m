#import "RivoMediaControls.h"
#import <MediaPlayer/MediaPlayer.h>
#import <AVFoundation/AVFoundation.h>

@implementation RivoMediaControls
{
    BOOL _hasListeners;
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

- (instancetype)init {
    if (self = [super init]) {
        [self setupRemoteCommands];
    }
    return self;
}

- (void)setupRemoteCommands {
    dispatch_async(dispatch_get_main_queue(), ^{
        MPRemoteCommandCenter *center = [MPRemoteCommandCenter sharedCommandCenter];
        
        [center.playCommand setEnabled:YES];
        [center.playCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
            if (self->_hasListeners) {
                [self sendEventWithName:@"onMediaAction" body:@"play"];
            }
            return MPRemoteCommandHandlerStatusSuccess;
        }];
        
        [center.pauseCommand setEnabled:YES];
        [center.pauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
            if (self->_hasListeners) {
                [self sendEventWithName:@"onMediaAction" body:@"pause"];
            }
            return MPRemoteCommandHandlerStatusSuccess;
        }];
        
        [center.togglePlayPauseCommand setEnabled:YES];
        [center.togglePlayPauseCommand addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent * _Nonnull event) {
            if (self->_hasListeners) {
                [self sendEventWithName:@"onMediaAction" body:@"play_pause"];
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
    });
}

RCT_EXPORT_METHOD(showNotification:(NSDictionary *)options) {
    [self updatePlayback:options];
}

RCT_EXPORT_METHOD(updatePlayback:(NSDictionary *)options) {
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            AVAudioSession *session = [AVAudioSession sharedInstance];
            [session setCategory:AVAudioSessionCategoryPlayback withOptions:AVAudioSessionCategoryOptionDuckOthers error:nil];
            [session setActive:YES error:nil];

            NSMutableDictionary *nowPlaying = [NSMutableDictionary dictionary];
            
            NSString *title = options[@"title"] ?: @"Unknown Track";
            NSString *artist = options[@"artist"] ?: @"Unknown Artist";
            BOOL isPlaying = [options[@"isPlaying"] boolValue];
            
            nowPlaying[MPMediaItemPropertyTitle] = title;
            nowPlaying[MPMediaItemPropertyArtist] = artist;
            nowPlaying[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? @(1.0) : @(0.0);
            
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
            [MPNowPlayingInfoCenter defaultCenter].nowPlayingInfo = nil;
        } @catch (NSException *e) {}
    });
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

@end
